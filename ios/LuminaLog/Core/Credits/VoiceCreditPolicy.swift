/// Voice Credits are paused by product decision on 2026-11-23. Keep the
/// purchase and metering implementation compiled for a deliberate future
/// re-enable, but do not expose or charge credits while this is false.
enum VoiceCreditPolicy {
    static let isEnabled = false
}
