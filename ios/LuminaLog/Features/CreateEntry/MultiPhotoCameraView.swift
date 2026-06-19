import AVFoundation
import SwiftUI
import UIKit

/// Full-screen multi-shot camera. Tapping the shutter captures instantly into a
/// thumbnail tray; the user keeps shooting and taps Done to return with every
/// captured JPEG. Replaces `CameraPicker` for the photo path; the video path
/// still uses `CameraPicker`. (design: 2026-06-19-multi-shot-camera)
struct MultiPhotoCameraView: UIViewControllerRepresentable {
    /// maxPhotos - already-staged photos, at present time.
    let remainingSlots: Int
    /// Fired once when the user taps Done, with all captured JPEGs (may be empty).
    var onComplete: ([Data]) -> Void

    func makeUIViewController(context: Context) -> MultiPhotoCameraController {
        let controller = MultiPhotoCameraController(remainingSlots: remainingSlots)
        controller.onDone = onComplete
        return controller
    }

    func updateUIViewController(_ uiViewController: MultiPhotoCameraController, context: Context) {}
}

final class MultiPhotoCameraController: UIViewController {

    var onDone: (([Data]) -> Void)?

    private var buffer: PhotoCaptureBuffer
    private let sessionQueue = DispatchQueue(label: "com.luminalog.camera.session")
    private let session = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private var previewLayer: AVCaptureVideoPreviewLayer!
    private var flashMode: AVCaptureDevice.FlashMode = .auto

    // UI
    private let shutterButton = UIButton(type: .custom)
    private let doneButton = UIButton(type: .system)
    private let flashButton = UIButton(type: .system)
    private let countLabel = UILabel()
    private let hintLabel = UILabel()
    private let trayScroll = UIScrollView()
    private let trayStack = UIStackView()
    private let deniedLabel = UILabel()
    private let settingsButton = UIButton(type: .system)

    init(remainingSlots: Int) {
        self.buffer = PhotoCaptureBuffer(remainingSlots: remainingSlots)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupPreviewLayer()
        setupOverlay()
        configureForAuthorization()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        startSessionIfAuthorized()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sessionQueue.async { [session] in
            if session.isRunning { session.stopRunning() }
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer.frame = view.bounds
    }

    // MARK: - Authorization

    private func configureForAuthorization() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    guard let self else { return }
                    if granted {
                        self.configureSession()
                        self.startSessionIfAuthorized()
                        self.showDenied(false)
                    } else {
                        self.showDenied(true)
                    }
                }
            }
        default:
            showDenied(true)
        }
    }

    private func startSessionIfAuthorized() {
        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else { return }
        sessionQueue.async { [session] in
            if !session.isRunning { session.startRunning() }
        }
    }

    // MARK: - Capture session

    private func setupPreviewLayer() {
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.addSublayer(previewLayer)
    }

    private func configureSession() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.session.beginConfiguration()
            self.session.sessionPreset = .photo
            if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
               let input = try? AVCaptureDeviceInput(device: device),
               self.session.canAddInput(input) {
                self.session.addInput(input)
            }
            if self.session.canAddOutput(self.photoOutput) {
                self.session.addOutput(self.photoOutput)
            }
            self.session.commitConfiguration()
        }
    }

    // MARK: - Overlay UI

    private func setupOverlay() {
        // Shutter
        shutterButton.translatesAutoresizingMaskIntoConstraints = false
        shutterButton.backgroundColor = .white
        shutterButton.layer.cornerRadius = 36
        shutterButton.layer.borderColor = UIColor.white.cgColor
        shutterButton.layer.borderWidth = 4
        shutterButton.addTarget(self, action: #selector(didTapShutter), for: .touchUpInside)
        view.addSubview(shutterButton)

        // Done
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        doneButton.setTitle("Done", for: .normal)
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
        doneButton.addTarget(self, action: #selector(didTapDone), for: .touchUpInside)
        view.addSubview(doneButton)

        // Flash
        flashButton.translatesAutoresizingMaskIntoConstraints = false
        flashButton.tintColor = .white
        flashButton.addTarget(self, action: #selector(didTapFlash), for: .touchUpInside)
        view.addSubview(flashButton)

        // Count
        countLabel.translatesAutoresizingMaskIntoConstraints = false
        countLabel.textColor = .white
        countLabel.font = .systemFont(ofSize: 14, weight: .medium)
        view.addSubview(countLabel)

        // Hint
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        hintLabel.textColor = .white
        hintLabel.font = .systemFont(ofSize: 13)
        hintLabel.textAlignment = .center
        hintLabel.text = "Up to \(AttachmentSet.maxPhotos) photos per entry."
        hintLabel.isHidden = true
        view.addSubview(hintLabel)

        // Tray
        trayScroll.translatesAutoresizingMaskIntoConstraints = false
        trayScroll.showsHorizontalScrollIndicator = false
        view.addSubview(trayScroll)
        trayStack.translatesAutoresizingMaskIntoConstraints = false
        trayStack.axis = .horizontal
        trayStack.spacing = 8
        trayScroll.addSubview(trayStack)

        // Denied state
        deniedLabel.translatesAutoresizingMaskIntoConstraints = false
        deniedLabel.text = "Camera access is off. Enable it in Settings to take photos."
        deniedLabel.textColor = .white
        deniedLabel.numberOfLines = 0
        deniedLabel.textAlignment = .center
        deniedLabel.isHidden = true
        view.addSubview(deniedLabel)
        settingsButton.translatesAutoresizingMaskIntoConstraints = false
        settingsButton.setTitle("Open Settings", for: .normal)
        settingsButton.addTarget(self, action: #selector(didTapSettings), for: .touchUpInside)
        settingsButton.isHidden = true
        view.addSubview(settingsButton)

        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            doneButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 12),
            doneButton.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -20),

            flashButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 12),
            flashButton.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 20),

            shutterButton.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -24),
            shutterButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            shutterButton.widthAnchor.constraint(equalToConstant: 72),
            shutterButton.heightAnchor.constraint(equalToConstant: 72),

            countLabel.centerYAnchor.constraint(equalTo: shutterButton.centerYAnchor),
            countLabel.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -24),

            trayScroll.bottomAnchor.constraint(equalTo: shutterButton.topAnchor, constant: -16),
            trayScroll.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            trayScroll.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            trayScroll.heightAnchor.constraint(equalToConstant: 60),

            trayStack.topAnchor.constraint(equalTo: trayScroll.topAnchor),
            trayStack.bottomAnchor.constraint(equalTo: trayScroll.bottomAnchor),
            trayStack.leadingAnchor.constraint(equalTo: trayScroll.leadingAnchor),
            trayStack.trailingAnchor.constraint(equalTo: trayScroll.trailingAnchor),
            trayStack.heightAnchor.constraint(equalTo: trayScroll.heightAnchor),

            hintLabel.bottomAnchor.constraint(equalTo: trayScroll.topAnchor, constant: -8),
            hintLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            deniedLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            deniedLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            deniedLabel.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 32),
            deniedLabel.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -32),
            settingsButton.topAnchor.constraint(equalTo: deniedLabel.bottomAnchor, constant: 16),
            settingsButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
        ])

        // Tap-to-focus
        let tap = UITapGestureRecognizer(target: self, action: #selector(didTapToFocus(_:)))
        view.addGestureRecognizer(tap)

        updateFlashIcon()
        refreshState()
    }

    // MARK: - Actions

    @objc private func didTapShutter() {
        guard buffer.canCapture else { return }
        let settings = AVCapturePhotoSettings()
        if photoOutput.supportedFlashModes.contains(flashMode) {
            settings.flashMode = flashMode
        }
        photoOutput.capturePhoto(with: settings, delegate: self)
        flashScreen()
    }

    @objc private func didTapDone() {
        onDone?(buffer.captured)
    }

    @objc private func didTapFlash() {
        switch flashMode {
        case .auto: flashMode = .on
        case .on: flashMode = .off
        default: flashMode = .auto
        }
        updateFlashIcon()
    }

    @objc private func didTapSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    @objc private func didTapToFocus(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: view)
        let devicePoint = previewLayer.captureDevicePointConverted(fromLayerPoint: point)
        sessionQueue.async { [weak self] in
            guard let self,
                  let device = (self.session.inputs.compactMap { $0 as? AVCaptureDeviceInput }.first)?.device,
                  (try? device.lockForConfiguration()) != nil else { return }
            if device.isFocusPointOfInterestSupported {
                device.focusPointOfInterest = devicePoint
                device.focusMode = .autoFocus
            }
            if device.isExposurePointOfInterestSupported {
                device.exposurePointOfInterest = devicePoint
                device.exposureMode = .autoExpose
            }
            device.unlockForConfiguration()
        }
    }

    @objc private func didTapRemove(_ sender: UIButton) {
        buffer.remove(at: sender.tag)
        rebuildTray()
        refreshState()
    }

    // MARK: - UI state

    private func refreshState() {
        countLabel.text = "\(buffer.captured.count)/\(AttachmentSet.maxPhotos)"
        let full = !buffer.canCapture
        shutterButton.isEnabled = !full
        shutterButton.alpha = full ? 0.4 : 1.0
        hintLabel.isHidden = !full
    }

    private func rebuildTray() {
        trayStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for (index, data) in buffer.captured.enumerated() {
            let container = UIView()
            container.translatesAutoresizingMaskIntoConstraints = false
            let imageView = UIImageView(image: UIImage(data: data))
            imageView.translatesAutoresizingMaskIntoConstraints = false
            imageView.contentMode = .scaleAspectFill
            imageView.clipsToBounds = true
            imageView.layer.cornerRadius = 6
            container.addSubview(imageView)
            let remove = UIButton(type: .system)
            remove.translatesAutoresizingMaskIntoConstraints = false
            remove.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
            remove.tintColor = .white
            remove.tag = index
            remove.addTarget(self, action: #selector(didTapRemove(_:)), for: .touchUpInside)
            container.addSubview(remove)
            trayStack.addArrangedSubview(container)
            NSLayoutConstraint.activate([
                container.widthAnchor.constraint(equalToConstant: 56),
                container.heightAnchor.constraint(equalToConstant: 56),
                imageView.topAnchor.constraint(equalTo: container.topAnchor),
                imageView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
                imageView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                imageView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
                remove.topAnchor.constraint(equalTo: container.topAnchor, constant: -2),
                remove.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: 2),
            ])
        }
    }

    private func updateFlashIcon() {
        let name: String
        switch flashMode {
        case .on: name = "bolt.fill"
        case .off: name = "bolt.slash.fill"
        default: name = "bolt.badge.a.fill"
        }
        flashButton.setImage(UIImage(systemName: name), for: .normal)
    }

    private func flashScreen() {
        let flash = UIView(frame: view.bounds)
        flash.backgroundColor = .black
        flash.alpha = 0
        view.addSubview(flash)
        UIView.animate(withDuration: 0.08, animations: { flash.alpha = 1 }) { _ in
            UIView.animate(withDuration: 0.12, animations: { flash.alpha = 0 }) { _ in
                flash.removeFromSuperview()
            }
        }
    }

    private func showDenied(_ denied: Bool) {
        deniedLabel.isHidden = !denied
        settingsButton.isHidden = !denied
        shutterButton.isHidden = denied
        flashButton.isHidden = denied
        countLabel.isHidden = denied
        trayScroll.isHidden = denied
    }
}

extension MultiPhotoCameraController: AVCapturePhotoCaptureDelegate {
    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        guard error == nil,
              let raw = photo.fileDataRepresentation(),
              let image = UIImage(data: raw),
              let jpeg = image.jpegData(compressionQuality: 0.85) else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.buffer.add(jpeg)
            self.rebuildTray()
            self.refreshState()
        }
    }
}
