import SwiftUI

/// One row in the Settings "Daily Reminders" card, backed by a `ReminderSlot`.
/// Holds its own `@AppStorage` for the slot's per-device preference keys so each
/// slot toggles independently. Editable slots (the primary reminder) reveal an
/// inline time picker when on; fixed slots show their time as a subtitle.
struct ReminderRowView: View {

    let slot: ReminderSlot
    let reminders: ReminderCoordinator
    /// Read lazily so the row always sees the latest loaded profile.
    let profile: () -> UserProfile?
    /// Shared across rows: set when the OS denied notification permission.
    @Binding var permissionDenied: Bool

    @AppStorage private var enabled: Bool
    @AppStorage private var hour: Int
    @AppStorage private var minute: Int

    init(
        slot: ReminderSlot,
        reminders: ReminderCoordinator,
        profile: @escaping () -> UserProfile?,
        permissionDenied: Binding<Bool>
    ) {
        self.slot = slot
        self.reminders = reminders
        self.profile = profile
        _permissionDenied = permissionDenied
        _enabled = AppStorage(wrappedValue: slot.defaultEnabled, slot.enabledKey)
        _hour = AppStorage(wrappedValue: slot.defaultHour, slot.hourKey)
        _minute = AppStorage(wrappedValue: slot.defaultMinute, slot.minuteKey)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: Spacing.m) {
                icon(iconName, tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text(slot.title)
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    if !slot.timeEditable {
                        Text(timeLabel)
                            .font(.captionText)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                Spacer()
                Toggle(slot.title, isOn: toggleBinding)
                    .tint(Color.accentWarm)
                    .labelsHidden()
            }
            .padding(Spacing.m)

            if slot.timeEditable && enabled {
                divider
                HStack(spacing: Spacing.m) {
                    icon("clock", tint: .textSecondary)
                    Text("Time")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Spacer()
                    DatePicker("Reminder time", selection: timeBinding, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                }
                .padding(Spacing.m)
            }
        }
    }

    private var toggleBinding: Binding<Bool> {
        Binding(
            get: { enabled },
            set: { newValue in
                if newValue {
                    Task {
                        let granted = await reminders.setEnabled(true, for: slot, profile: profile())
                        enabled = granted
                        permissionDenied = !granted
                    }
                } else {
                    permissionDenied = false
                    enabled = false
                    Task { await reminders.setEnabled(false, for: slot, profile: profile()) }
                }
            }
        )
    }

    private var timeBinding: Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: Date()) ?? Date()
            },
            set: { newDate in
                let comps = Calendar.current.dateComponents([.hour, .minute], from: newDate)
                hour = comps.hour ?? slot.defaultHour
                minute = comps.minute ?? slot.defaultMinute
                Task { await reminders.refresh(profile: profile()) }
            }
        )
    }

    private var timeLabel: String {
        let date = Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: Date()) ?? Date()
        return date.formatted(date: .omitted, time: .shortened)
    }

    /// SF Symbol per slot — a bell for the configurable primary, sunset/moon for
    /// the fixed evening and night reminders.
    private var iconName: String {
        switch slot.id {
        case "ll-reminder-evening": return "sunset"
        case "ll-reminder-night": return "moon.stars"
        default: return "bell.badge"
        }
    }

    private func icon(_ systemName: String, tint: Color) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(tint)
            .frame(width: 30, height: 30)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous)
                    .fill(tint.opacity(0.12))
            )
    }

    private var divider: some View {
        Divider().padding(.leading, Spacing.m + 30 + Spacing.m)
    }
}
