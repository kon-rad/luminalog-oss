import UIKit

/// Loads a card background photo to a `UIImage` (with an in-memory cache) so the
/// card renders the photo both on screen and inside `ImageRenderer` — which
/// cannot resolve a SwiftUI `AsyncImage`.
enum CardImageLoader {
    private static let cache = NSCache<NSURL, UIImage>()

    static func load(_ url: URL?) async -> UIImage? {
        guard let url else { return nil }
        if let hit = cache.object(forKey: url as NSURL) { return hit }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let image = UIImage(data: data) else { return nil }
            cache.setObject(image, forKey: url as NSURL)
            return image
        } catch {
            return nil
        }
    }
}
