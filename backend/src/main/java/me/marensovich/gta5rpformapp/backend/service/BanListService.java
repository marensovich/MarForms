package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.BanListEntry;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.BanListRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.ban.BanDto;
import me.marensovich.gta5rpformapp.backend.dto.ban.BanRequest;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * A guild's ban list (E2.2, task #68): users barred from submitting that
 * guild's forms. Enforced by {@code FormAccessService}, so the public form
 * page and submission intake both refuse a banned user.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class BanListService {

    private final BanListRepository banListRepository;
    private final GuildMembershipRepository guildMembershipRepository;
    private final UserRepository userRepository;
    private final GuildService guildService;
    private final AuditLogService auditLogService;

    /**
     * Whether a user is banned from a guild's forms.
     *
     * @param guildId   the Discord guild snowflake ID
     * @param discordId the user's Discord ID
     * @return {@code true} if banned
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public boolean isBanned(Long guildId, Long discordId) {
        return banListRepository.existsByGuildIdAndDiscordId(guildId, discordId);
    }

    /**
     * The guild's bans, newest first.
     *
     * @param guildId the Discord guild snowflake ID
     * @return the bans, with usernames where known
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public List<BanDto> list(Long guildId) {
        List<BanListEntry> entries = banListRepository.findAllByGuildIdOrderByCreatedAtDesc(guildId);
        Set<Long> ids = new HashSet<>();
        for (BanListEntry e : entries) {
            ids.add(e.getDiscordId());
            if (e.getBannedBy() != null) ids.add(e.getBannedBy());
        }
        Map<Long, String> names = usernames(ids);
        return entries.stream().map(e -> toDto(e, names)).toList();
    }

    /**
     * Bans a user from the guild's forms. The guild's owner and its
     * moderators can't be banned: remove the moderator role first.
     *
     * @param guildId the Discord guild snowflake ID
     * @param request who to ban, and why
     * @param actorId the Discord ID of the staff member issuing the ban
     * @return the new ban
     * @throws IllegalArgumentException if the target is missing, invalid, staff or the actor
     * @throws NotFoundException        if a username matches no known user
     * @throws InvalidStateException    if the user is already banned
     * @since v.0.1
     */
    @Transactional
    public BanDto ban(Long guildId, BanRequest request, Long actorId) {
        Long target = resolveDiscordId(request);
        if (target.equals(actorId)) {
            throw new IllegalArgumentException("You can't ban yourself");
        }
        guildMembershipRepository.findByUser_DiscordIdAndGuild_DiscordGuildId(target, guildId)
                .filter(m -> m.getRole() != GuildRole.RESPONDENT)
                .ifPresent(m -> {
                    throw new IllegalArgumentException(m.getRole() == GuildRole.OWNER
                            ? "The server owner can't be banned"
                            : "This user is a moderator: remove the moderator role first");
                });
        if (banListRepository.existsByGuildIdAndDiscordId(guildId, target)) {
            throw new InvalidStateException("This user is already banned on this server");
        }

        guildService.getOrCreate(guildId);
        BanListEntry entry = new BanListEntry();
        entry.setGuildId(guildId);
        entry.setDiscordId(target);
        entry.setBannedBy(actorId);
        entry.setReason(request.reason() == null || request.reason().isBlank() ? null : request.reason().trim());
        entry = banListRepository.save(entry);
        BanDto dto = toDto(entry, usernames(Set.of(target, actorId)));
        auditLogService.logGuildAction(guildId, AuditAction.GUILD_BAN_ADDED, "USER", target.toString(),
                dto.username(), entry.getReason() != null ? Map.of("reason", entry.getReason()) : null,
                entry.getReason() != null ? "Reason: " + entry.getReason() : null);
        return dto;
    }

    /**
     * Lifts a ban.
     *
     * @param guildId   the Discord guild snowflake ID
     * @param discordId the banned user's Discord ID
     * @throws NotFoundException if the user isn't banned on this guild
     * @since v.0.1
     */
    @Transactional
    public void unban(Long guildId, Long discordId) {
        BanListEntry entry = banListRepository.findByGuildIdAndDiscordId(guildId, discordId)
                .orElseThrow(() -> new NotFoundException("User " + discordId + " is not banned on this server"));
        banListRepository.delete(entry);
        auditLogService.logGuildAction(guildId, AuditAction.GUILD_BAN_REMOVED, "USER", discordId.toString(),
                usernames(Set.of(discordId)).get(discordId), null, null);
    }

    private Long resolveDiscordId(BanRequest request) {
        if (request == null) throw new IllegalArgumentException("Specify a Discord ID or username");
        if (request.discordId() != null && !request.discordId().isBlank()) {
            try {
                return Long.parseUnsignedLong(request.discordId().trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid Discord ID: " + request.discordId());
            }
        }
        if (request.username() != null && !request.username().isBlank()) {
            String username = request.username().trim();
            List<User> matches = userRepository.findAllByDiscordUsernameContainingIgnoreCase(username).stream()
                    .filter(u -> u.getDiscordUsername().equalsIgnoreCase(username))
                    .toList();
            if (matches.isEmpty()) {
                throw new NotFoundException("No user named " + username + ": use their Discord ID instead");
            }
            if (matches.size() > 1) {
                throw new IllegalArgumentException("Several users are named " + username + ": use the Discord ID");
            }
            return matches.getFirst().getDiscordId();
        }
        throw new IllegalArgumentException("Specify a Discord ID or username");
    }

    private Map<Long, String> usernames(Collection<Long> discordIds) {
        return userRepository.findAllByDiscordIdIn(discordIds).stream()
                .collect(Collectors.toMap(User::getDiscordId, User::getDiscordUsername, (a, b) -> a));
    }

    private static BanDto toDto(BanListEntry e, Map<Long, String> names) {
        return new BanDto(e.getDiscordId(), names.get(e.getDiscordId()), e.getReason(), e.getBannedBy(),
                e.getBannedBy() != null ? names.get(e.getBannedBy()) : null, e.getCreatedAt());
    }
}
