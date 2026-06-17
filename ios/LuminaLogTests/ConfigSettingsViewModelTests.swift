import XCTest
@testable import LuminaLog

@MainActor
final class ConfigSettingsViewModelTests: XCTestCase {

    func testLoadsDefaultsWhenProfileHasNoConfig() {
        let profile = UserProfile(id: "u")
        let vm = ConfigSettingsViewModel(profile: profile, profiles: MockProfileRepository())
        XCTAssertEqual(vm.wordLength, ConfigSettingsViewModel.defaultWordLength)
        XCTAssertEqual(vm.systemPrompt, ConfigSettingsViewModel.defaultSystemPrompt)
    }

    func testReUsesExistingConfig() {
        var profile = UserProfile(id: "u")
        profile.summaryConfig = .init(wordLength: 80, systemPrompt: "Custom.")
        let vm = ConfigSettingsViewModel(profile: profile, profiles: MockProfileRepository())
        XCTAssertEqual(vm.wordLength, 80)
        XCTAssertEqual(vm.systemPrompt, "Custom.")
    }

    func testResetRestoresDefaults() {
        var profile = UserProfile(id: "u")
        profile.summaryConfig = .init(wordLength: 80, systemPrompt: "Custom.")
        let vm = ConfigSettingsViewModel(profile: profile, profiles: MockProfileRepository())
        vm.resetToDefaults()
        XCTAssertEqual(vm.wordLength, ConfigSettingsViewModel.defaultWordLength)
        XCTAssertEqual(vm.systemPrompt, ConfigSettingsViewModel.defaultSystemPrompt)
    }

    func testSavePersistsConfig() async {
        let repo = MockProfileRepository()
        let vm = ConfigSettingsViewModel(profile: UserProfile(id: "u"), profiles: repo)
        vm.wordLength = 65
        vm.systemPrompt = "Be terse about {type}."
        await vm.save()
        XCTAssertEqual(repo.lastSaved?.summaryConfig?.wordLength, 65)
        XCTAssertEqual(repo.lastSaved?.summaryConfig?.systemPrompt, "Be terse about {type}.")
    }
}
