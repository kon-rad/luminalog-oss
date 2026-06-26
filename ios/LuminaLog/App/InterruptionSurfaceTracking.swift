import SwiftUI

/// Marks its content as an "interrupting surface": while presented, the
/// `AppActivityMonitor` gate stays closed so the milestone popup waits. Applied
/// to full-screen covers (CreateEntry, voice/text chat) and pushed detail views.
private struct InterruptionSurfaceTracker: ViewModifier {
    let monitor: AppActivityMonitor
    func body(content: Content) -> some View {
        content
            .onAppear { monitor.beginSurface() }
            .onDisappear { monitor.endSurface() }
    }
}

extension View {
    /// Counts this view as a presented interrupting surface for the lifetime of
    /// its appearance.
    func tracksInterruptionSurface(_ monitor: AppActivityMonitor) -> some View {
        modifier(InterruptionSurfaceTracker(monitor: monitor))
    }
}
