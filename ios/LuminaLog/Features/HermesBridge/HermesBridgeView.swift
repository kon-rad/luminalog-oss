import SwiftUI

/// `#if DEBUG`-only panel for the Hermes Bridge feature
/// (`docs/features/hermes-bridge.md`): pairs with the `hermes-bridge`
/// gateway, then shows recent tasks/changes and a live `run_hermes.sh`
/// session. Presented as a sheet from `SettingsView`'s developer-tools
/// section.
struct HermesBridgeView: View {

    private enum Tab: String, CaseIterable { case tasks = "Tasks", changes = "Changes", live = "Live" }

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: HermesBridgeViewModel
    @State private var tab: Tab = .tasks
    @State private var inputText = ""

    init(viewModel: @autoclosure @escaping () -> HermesBridgeViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.pairingState {
                case .unpaired:
                    PairingFormView(viewModel: viewModel)
                case .paired:
                    pairedBody
                }
            }
            .navigationTitle("Hermes Bridge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
                if case .paired = viewModel.pairingState {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Unpair", role: .destructive) { viewModel.unpair() }
                    }
                }
            }
        }
    }

    private var pairedBody: some View {
        VStack(spacing: 0) {
            Picker("View", selection: $tab) {
                ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding()

            Divider()

            switch tab {
            case .tasks:
                taskList
            case .changes:
                changeList
            case .live:
                liveSession
            }
        }
    }

    private var taskList: some View {
        List(viewModel.tasks) { task in
            VStack(alignment: .leading, spacing: 4) {
                Text(task.title).font(.body)
                Text(task.status).font(.caption).foregroundStyle(.secondary)
            }
        }
        .overlay {
            if viewModel.tasks.isEmpty { Text("No completed tasks yet").foregroundStyle(.secondary) }
        }
        .task { await viewModel.loadRecentTasks() }
        .refreshable { await viewModel.loadRecentTasks() }
    }

    private var changeList: some View {
        List(viewModel.commits) { commit in
            VStack(alignment: .leading, spacing: 4) {
                Text(commit.subject).font(.body)
                Text("\(commit.shortHash) · \(commit.author)").font(.caption).foregroundStyle(.secondary)
            }
        }
        .overlay {
            if viewModel.commits.isEmpty { Text("No commits found").foregroundStyle(.secondary) }
        }
        .task { await viewModel.loadRecentChanges() }
        .refreshable { await viewModel.loadRecentChanges() }
    }

    private var liveSession: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(viewModel.outputLines.enumerated()), id: \.offset) { index, line in
                            Text(line)
                                .font(.system(.caption, design: .monospaced))
                                .id(index)
                        }
                    }
                    .padding(8)
                }
                .onChange(of: viewModel.outputLines.count) { _, _ in
                    guard let lastIndex = viewModel.outputLines.indices.last else { return }
                    withAnimation { proxy.scrollTo(lastIndex, anchor: .bottom) }
                }
            }
            .background(Color.black.opacity(0.85))

            Divider()

            HStack {
                if !viewModel.isStreamConnected {
                    Button("Start Hermes session") { Task { await viewModel.startHermesSession() } }
                        .buttonStyle(.borderedProminent)
                } else {
                    TextField("Type input…", text: $inputText)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit { sendInput() }
                    Button("Send") { sendInput() }
                        .disabled(inputText.isEmpty)
                }
            }
            .padding()
        }
        .onDisappear { viewModel.disconnectStream() }
    }

    private func sendInput() {
        let text = inputText
        inputText = ""
        Task { await viewModel.sendInput(text) }
    }
}

/// The unpaired-state form: gateway URL + one-time pairing code.
private struct PairingFormView: View {

    @ObservedObject var viewModel: HermesBridgeViewModel
    @State private var baseURLString = ""
    @State private var code = ""
    @State private var deviceName = UIDevice.current.name
    @State private var isPairing = false

    var body: some View {
        Form {
            Section("Gateway") {
                TextField("https://your-server:8787", text: $baseURLString)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("6-digit pairing code", text: $code)
                    .keyboardType(.numberPad)
                TextField("Device name", text: $deviceName)
            }

            if let errorMessage = viewModel.errorMessage {
                Section {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }

            Section {
                Button {
                    Task {
                        isPairing = true
                        await viewModel.pair(baseURLString: baseURLString, code: code, deviceName: deviceName)
                        isPairing = false
                    }
                } label: {
                    if isPairing {
                        ProgressView()
                    } else {
                        Text("Pair")
                    }
                }
                .disabled(baseURLString.isEmpty || code.isEmpty || isPairing)
            } footer: {
                Text("Run `npm run pair` on the gateway host, then enter the code within 5 minutes.")
            }
        }
    }
}
