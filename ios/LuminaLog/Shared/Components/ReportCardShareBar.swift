import SwiftUI
import UIKit

/// The share controls beneath the Daily Report Card: a branded platform-icon
/// row (Stories · Post · X · LinkedIn · Facebook) plus a Download / Share pair.
/// Every platform tap saves the card to Photos once, then opens that app's
/// composer (or the web fallback when the app isn't installed).
struct ReportCardShareBar: View {
    /// Lazily renders the card to an image; the bar caches the first result so
    /// repeated taps don't re-render.
    let makeImage: @MainActor () -> UIImage
    let caption: String
    /// Hands a freshly-rendered image to the parent's system share sheet.
    let onShareSheet: (UIImage) -> Void

    @State private var cachedImage: UIImage?
    @State private var savedThisSession = false
    @State private var savePending = false
    @State private var toastMessage: String?
    @State private var showPhotoDeniedAlert = false

    private let service = SocialShareService()

    var body: some View {
        VStack(spacing: Spacing.m) {
            HStack(spacing: 0) {
                ForEach(SocialPlatform.allCases) { platform in
                    Button { handlePlatform(platform) } label: {
                        PlatformTile(platform: platform)
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(platform.accessibilityName)
                }
            }

            HStack(spacing: Spacing.s) {
                Button { handleDownload() } label: {
                    Label("Download", systemImage: "arrow.down.to.line")
                        .font(.uiBody.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered).tint(Color.accentWarm)

                Button { onShareSheet(currentImage()) } label: {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .font(.uiBody.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.borderedProminent).tint(Color.accentWarm)
            }
        }
        .toast(message: $toastMessage)
        .alert("Photo Access Needed", isPresented: $showPhotoDeniedAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Allow photo access so LuminaLog can save your card before sharing.")
        }
    }

    // MARK: - Actions

    private func currentImage() -> UIImage {
        if let cachedImage { return cachedImage }
        let img = makeImage()
        cachedImage = img
        return img
    }

    private func handlePlatform(_ platform: SocialPlatform) {
        Task {
            guard await ensureSaved(currentImage()) else { return }
            service.share(platform, caption: caption)
        }
    }

    private func handleDownload() {
        Task { _ = await ensureSaved(currentImage()) }
    }

    /// Saves the card to Photos at most once per session and surfaces the right
    /// toast/alert. Returns whether the image is now in the library.
    @discardableResult
    private func ensureSaved(_ image: UIImage) async -> Bool {
        if savedThisSession { return true }
        // Guard against a second tap racing in while the first save is still
        // awaiting authorization/write — otherwise we'd save (and toast) twice.
        if savePending { return false }
        savePending = true
        defer { savePending = false }
        switch await PhotoSaver.save(image) {
        case .saved:
            savedThisSession = true
            toastMessage = "Saved to Photos"
            return true
        case .denied:
            showPhotoDeniedAlert = true
            return false
        case .failed:
            toastMessage = "Couldn't save image"
            return false
        }
    }
}

/// A branded, rounded-square icon tile with a label beneath.
private struct PlatformTile: View {
    let platform: SocialPlatform

    var body: some View {
        VStack(spacing: 5) {
            ZStack { background; glyph }
                .frame(width: 52, height: 52)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous))
            Text(platform.displayName)
                .font(.system(size: 11))
                .foregroundStyle(Color.textSecondary)
        }
    }

    @ViewBuilder private var background: some View {
        switch platform {
        case .instagramStories:
            LinearGradient(colors: [.brand(0xFEDA75), .brand(0xD62976),
                                    .brand(0x962FBF), .brand(0x4F5BD5)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        case .instagramPost:
            LinearGradient(colors: [.brand(0xFEDA75), .brand(0xFA7E1E), .brand(0xD62976)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        case .x:        Color.black
        case .linkedIn: Color.brand(0x0A66C2)
        case .facebook: Color.brand(0x1877F2)
        }
    }

    @ViewBuilder private var glyph: some View {
        switch platform {
        case .instagramStories: brandSymbol("camera.circle")
        case .instagramPost:    brandSymbol("camera")
        case .x:                Text("𝕏").font(.system(size: 22, weight: .bold)).foregroundStyle(.white)
        case .linkedIn:         Text("in").font(.system(size: 20, weight: .heavy)).foregroundStyle(.white)
        case .facebook:         Text("f").font(.system(size: 24, weight: .black, design: .serif)).foregroundStyle(.white)
        }
    }

    private func brandSymbol(_ systemName: String) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 22, weight: .semibold))
            .foregroundStyle(.white)
    }
}

private extension Color {
    /// Build a Color from a 0xRRGGBB hex literal. File-private to avoid clashing
    /// with any future shared helper.
    static func brand(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 0xFF) / 255,
              green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255)
    }
}
