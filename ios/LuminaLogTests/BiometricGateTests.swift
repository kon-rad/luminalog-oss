import XCTest
import LocalAuthentication
@testable import LuminaLog

private final class FakeBiometricContext: BiometricContext {
    var available: Bool
    var evaluateResult: Result<Bool, Error>
    private(set) var evaluateCalled = false

    init(available: Bool, evaluateResult: Result<Bool, Error> = .success(true)) {
        self.available = available
        self.evaluateResult = evaluateResult
    }

    func canEvaluatePolicy(_ policy: LAPolicy, error: NSErrorPointer) -> Bool {
        if !available {
            error?.pointee = NSError(domain: LAErrorDomain,
                                     code: LAError.biometryNotAvailable.rawValue)
        }
        return available
    }

    func evaluatePolicy(_ policy: LAPolicy, localizedReason: String) async throws -> Bool {
        evaluateCalled = true
        return try evaluateResult.get()
    }
}

final class BiometricGateTests: XCTestCase {

    func testSuccessPath() async throws {
        let ctx = FakeBiometricContext(available: true, evaluateResult: .success(true))
        let gate = BiometricGate(context: ctx)
        XCTAssertTrue(gate.isAvailable)
        try await gate.evaluate(reason: "Unlock your journal")
        XCTAssertTrue(ctx.evaluateCalled)
    }

    func testDeniedPathFailsClosed() async {
        // User denies / cancels → evaluatePolicy returns false.
        let ctx = FakeBiometricContext(available: true, evaluateResult: .success(false))
        let gate = BiometricGate(context: ctx)
        do {
            try await gate.evaluate(reason: "Unlock")
            XCTFail("Expected .failed")
        } catch {
            XCTAssertEqual(error as? BiometricGateError, .failed)
        }
    }

    func testErrorPathPropagatesAsFailure() async {
        let underlying = NSError(domain: LAErrorDomain, code: LAError.userCancel.rawValue)
        let ctx = FakeBiometricContext(available: true, evaluateResult: .failure(underlying))
        let gate = BiometricGate(context: ctx)
        do {
            try await gate.evaluate(reason: "Unlock")
            XCTFail("Expected a thrown error")
        } catch {
            // The underlying LAError is surfaced (fail closed — no silent success).
            XCTAssertEqual((error as NSError).code, LAError.userCancel.rawValue)
        }
    }

    func testUnavailablePathFailsClosed() async {
        let ctx = FakeBiometricContext(available: false)
        let gate = BiometricGate(context: ctx)
        XCTAssertFalse(gate.isAvailable)
        do {
            try await gate.evaluate(reason: "Unlock")
            XCTFail("Expected .unavailable")
        } catch {
            XCTAssertEqual(error as? BiometricGateError, .unavailable)
        }
        XCTAssertFalse(ctx.evaluateCalled)
    }
}
