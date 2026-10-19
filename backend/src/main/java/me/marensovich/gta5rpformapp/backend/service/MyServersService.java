package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.dto.guild.GuildMembershipDto;
import me.marensovich.gta5rpformapp.backend.exception.TooManyRequestsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * «Мои серверы» (#124, ТЗ 4.2): the user's servers with the bot's state and
 * the counters of their cards, and re-reading them from Discord.
 *
 * @author marensovich
 * @since v.0.1
 */
@lombok.extern.slf4j.Slf4j
@Service
@RequiredArgsConstructor
public class MyServersService {

    static final Duration REFRESH_INTERVAL = Duration.ofMinutes(1);
    /** How often «Мои серверы» looks for servers where the user holds an admin role (2026-10-19). */
    static final Duration CLAIM_INTERVAL = Duration.ofMinutes(2);

    private final GuildMembershipRepository guildMembershipRepository;
    private final FormRepository formRepository;
    private final SubmissionRepository submissionRepository;
    private final GuildService guildService;
    private final GuildSettingsService guildSettingsService;
    private final org.springframework.transaction.PlatformTransactionManager transactionManager;
    /** Last look for servers where the user holds an admin role. */
    private final Map<Long, Instant> lastClaim = new ConcurrentHashMap<>();
    /** Last refresh per user; a refresh calls Discord once per server. */
    private final Map<Long, Instant> lastRefresh = new ConcurrentHashMap<>();

    /**
     * The user's servers, newest membership first. Counters only where they
     * staff the server: a respondent's row says nothing about the server's forms.
     *
     * @param user the current user
     * @return their servers
     * @since v.0.1
     */
    public List<GuildMembershipDto> list(User user) {
        Instant now = Instant.now();
        Instant previous = lastClaim.get(user.getId());
        if (previous == null || previous.plus(CLAIM_INTERVAL).isBefore(now)) {
            lastClaim.put(user.getId(), now);
            claim(user);
        }
        return cards(user);
    }

    private void claim(User user) {
        try {
            guildSettingsService.claimAdminRoleOwnerships(user);
        } catch (Exception e) {
            log.warn("Could not look for admin roles of user {}: {}", user.getDiscordId(), e.getMessage());
        }
    }

    /** Read in one transaction: the cards read the rows' lazy guilds. */
    private List<GuildMembershipDto> cards(User user) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setReadOnly(true);
        return tx.execute(status -> guildMembershipRepository.findAllByUser_Id(user.getId()).stream()
                .map(this::card)
                .sorted(Comparator.comparing(GuildMembershipDto::since).reversed())
                .toList());
    }

    /**
     * Re-reads the user's staffed servers from Discord, then lists them.
     *
     * @param user the current user
     * @return their servers, refreshed
     * @throws TooManyRequestsException if they refreshed less than a minute ago
     * @since v.0.1
     */
    public List<GuildMembershipDto> refresh(User user) {
        Instant now = Instant.now();
        Instant previous = lastRefresh.get(user.getId());
        if (previous != null && previous.plus(REFRESH_INTERVAL).isAfter(now)) {
            throw new TooManyRequestsException("The servers were refreshed less than a minute ago");
        }
        lastRefresh.put(user.getId(), now);
        lastClaim.put(user.getId(), now);
        claim(user);
        for (GuildMembership m : guildMembershipRepository.findAllByUser_Id(user.getId())) {
            if (m.getRole() != GuildRole.RESPONDENT) guildService.sync(m.getGuild().getDiscordGuildId());
        }
        return cards(user);
    }

    private GuildMembershipDto card(GuildMembership m) {
        if (m.getRole() == GuildRole.RESPONDENT) return GuildMembershipDto.from(m);
        Long guildId = m.getGuild().getDiscordGuildId();
        if (m.getRole() == GuildRole.MODERATOR && m.isFormsRestricted()) {
            // Only the forms the owner left them (#18).
            Set<UUID> forms = guildMembershipRepository.findFormIds(m.getId());
            return forms.isEmpty() ? GuildMembershipDto.from(m, 0, 0)
                    : GuildMembershipDto.from(m, formRepository.countByIdInAndStatus(forms, FormStatus.PUBLISHED),
                    submissionRepository.countByFormIdInAndStatus(forms, SubmissionStatus.PENDING));
        }
        return GuildMembershipDto.from(m, formRepository.countByServerIdAndStatus(guildId, FormStatus.PUBLISHED),
                submissionRepository.countInGuildByStatus(guildId, SubmissionStatus.PENDING));
    }
}
