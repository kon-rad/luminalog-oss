import Foundation
import CryptoKit

enum MediaCipherError: LocalizedError {
    case malformedFile
    case decryptionFailed

    var errorDescription: String? {
        switch self {
        case .malformedFile: return "The media file was malformed."
        case .decryptionFailed: return "Could not decrypt the media file."
        }
    }
}

/// Encrypts/decrypts media files in fixed-size AES-GCM chunks (spec §7) so large
/// videos never sit fully in memory. On-disk layout:
///   [ "LLM1" magic (4B) ][ chunkSize UInt32 BE (4B) ]
///   then, per chunk: [ length UInt32 BE ][ AES.GCM.combined bytes ]
/// Each chunk is sealed with AAD = its zero-based index, so chunks cannot be
/// reordered, dropped, or duplicated without failing authentication.
struct MediaCipher {

    static let magic = Data("LLM1".utf8)

    private let key: SymmetricKey
    private let chunkSize: Int

    init(key: SymmetricKey, chunkSize: Int = 1 << 20) {   // 1 MiB default
        self.key = key
        self.chunkSize = chunkSize
    }

    func encryptFile(at source: URL, to destination: URL) throws {
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }
        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let output = try FileHandle(forWritingTo: destination)
        defer { try? output.close() }

        output.write(Self.magic)
        output.write(Self.uint32BE(UInt32(chunkSize)))

        var index: UInt32 = 0
        while case let chunk = input.readData(ofLength: chunkSize), !chunk.isEmpty {
            let sealed = try AES.GCM.seal(chunk, using: key,
                                          authenticating: Self.uint32BE(index))
            let blob = sealed.combined ?? Data()
            output.write(Self.uint32BE(UInt32(blob.count)))
            output.write(blob)
            index += 1
        }
    }

    func decryptFile(at source: URL, to destination: URL) throws {
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }

        guard input.readData(ofLength: 4) == Self.magic else {
            throw MediaCipherError.malformedFile
        }
        _ = input.readData(ofLength: 4)   // chunkSize header (informational)

        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let output = try FileHandle(forWritingTo: destination)
        defer { try? output.close() }

        var index: UInt32 = 0
        while case let lengthData = input.readData(ofLength: 4), !lengthData.isEmpty {
            guard lengthData.count == 4 else { throw MediaCipherError.malformedFile }
            let length = Int(Self.readUint32BE(lengthData))
            let blob = input.readData(ofLength: length)
            guard blob.count == length else { throw MediaCipherError.malformedFile }
            do {
                let box = try AES.GCM.SealedBox(combined: blob)
                let plain = try AES.GCM.open(box, using: key,
                                             authenticating: Self.uint32BE(index))
                output.write(plain)
            } catch {
                throw MediaCipherError.decryptionFailed
            }
            index += 1
        }
    }

    // MARK: - Byte helpers

    private static func uint32BE(_ value: UInt32) -> Data {
        var be = value.bigEndian
        return Data(bytes: &be, count: 4)
    }

    private static func readUint32BE(_ data: Data) -> UInt32 {
        data.withUnsafeBytes { $0.load(as: UInt32.self) }.bigEndian
    }
}
