package me.marensovich.gta5rpformapp.backend.service.forms;

import me.marensovich.gta5rpformapp.backend.data.forms.AccessCode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RoleGate rules (E2.1, #65): allow list + deny list, deny wins
 * (owner decision 2026-10-11, question 2 = B).
 */
class RoleGateTest {

    private static final long ADMIN = 1L, MEMBER = 2L, MUTED = 3L, GUEST = 4L;

    private static Form gate(Set<Long> allowed, Set<Long> denied) {
        Form form = new Form();
        form.setAccessMode(FormAccessMode.ROLE_GATED);
        form.getAllowedRoleIds().addAll(allowed);
        form.getDeniedRoleIds().addAll(denied);
        return form;
    }

    @Test
    void anAllowedRoleGrantsAccess() {
        Form form = gate(Set.of(ADMIN, MEMBER), Set.of());
        assertThat(FormAccessService.checkRoleGate(form, List.of(GUEST, MEMBER))).isEqualTo(AccessCode.GRANTED);
    }

    @Test
    void withoutAnAllowedRoleAccessIsRefused() {
        Form form = gate(Set.of(ADMIN, MEMBER), Set.of());
        assertThat(FormAccessService.checkRoleGate(form, List.of(GUEST))).isEqualTo(AccessCode.ROLE_REQUIRED);
        assertThat(FormAccessService.checkRoleGate(form, List.of())).isEqualTo(AccessCode.ROLE_REQUIRED);
    }

    @Test
    void aDeniedRoleWinsOverAnAllowedOne() {
        Form form = gate(Set.of(MEMBER), Set.of(MUTED));
        assertThat(FormAccessService.checkRoleGate(form, List.of(MEMBER, MUTED))).isEqualTo(AccessCode.ROLE_DENIED);
    }

    @Test
    void aDenyOnlyGateLetsEveryoneElseIn() {
        Form form = gate(Set.of(), Set.of(MUTED));
        assertThat(FormAccessService.checkRoleGate(form, List.of())).isEqualTo(AccessCode.GRANTED);
        assertThat(FormAccessService.checkRoleGate(form, List.of(GUEST))).isEqualTo(AccessCode.GRANTED);
        assertThat(FormAccessService.checkRoleGate(form, List.of(MUTED))).isEqualTo(AccessCode.ROLE_DENIED);
    }

    @Test
    void unknownRolesAreNotGuessed() {
        Form form = gate(Set.of(), Set.of(MUTED));
        assertThat(FormAccessService.checkRoleGate(form, null)).isEqualTo(AccessCode.ROLE_CHECK_FAILED);
    }
}
