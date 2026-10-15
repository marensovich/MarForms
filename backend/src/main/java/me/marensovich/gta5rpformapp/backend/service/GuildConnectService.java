package me.marensovich.gta5rpformapp.backend.service;

import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.config.security.Sha256;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildConnectRequest;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildConnectRequestRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.exception.TooManyRequestsException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.GuildManagerCheck;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * The "Add to Discord" bot-install flow (security audit, #103).
 * <p>
 * The install link carries a random one-time nonce as OAuth {@code state},
 * never a session token. The callback is trusted only after two checks: the
 * nonce is one this server issued, unexpired and unused, and the bot — now on
 * the guild — confirms the user who started the install owns it or has
 * {@code MANAGE_SERVER} there. The {@code guild_id} Discord appends to the
 * redirect is otherwise just a claim anyone can type.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
public class GuildConnectService {

    static final Duration REQUEST_TTL = Duration.ofMinutes(15);
    /** Open installs per user within {@link #REQUEST_TTL}; any user may start one (#151). */
    static final int MAX_OPEN_REQUESTS = 10;

    private final GuildConnectRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final GuildMembershipService guildMembershipService;
    private final GuildService guildService;
    private final DiscordBotClient botClient;
    private final AuditLogService auditLogService;
    private final Duration botJoinWait;

    public GuildConnectService(GuildConnectRequestRepository requestRepository, UserRepository userRepository,
                               GuildMembershipService guildMembershipService, GuildService guildService,
                               DiscordBotClient botClient, AuditLogService auditLogService,
                               @Value("${app.guild-connect.bot-join-wait:PT5S}") Duration botJoinWait) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.guildMembershipService = guildMembershipService;
        this.guildService = guildService;
        this.botClient = botClient;
        this.auditLogService = auditLogService;
        this.botJoinWait = botJoinWait;
    }

    /** How a callback ended. */
    public enum Outcome {
        CONNECTED,
        /** Unknown, expired or already used state. */
        INVALID_STATE,
        /** The bot never showed up on the guild (or there is no bot session). */
        BOT_NOT_IN_GUILD,
        /** The user doesn't own or manage the guild. */
        NOT_GUILD_MANAGER
    }

    /**
     * Starts an install for a user.
     *
     * @param discordId the signed-in user's Discord ID
     * @return the nonce to send as OAuth {@code state}
     * @throws TooManyRequestsException if the user has too many unfinished installs
     * @since v.0.1
     */
    public String start(Long discordId) {
        requestRepository.deleteExpired(LocalDateTime.now());
        if (requestRepository.countByDiscordId(discordId) >= MAX_OPEN_REQUESTS) {
            throw new TooManyRequestsException("Too many server connections started — try again in a few minutes");
        }
        String nonce = Sha256.randomToken();

        GuildConnectRequest request = new GuildConnectRequest();
        request.setNonceHash(Sha256.hex(nonce));
        request.setDiscordId(discordId);
        request.setExpiresAt(LocalDateTime.now().plus(REQUEST_TTL));
        requestRepository.save(request);
        return nonce;
    }

    /**
     * Completes an install from Discord's redirect.
     *
     * @param state   the {@code state} parameter
     * @param guildId the {@code guild_id} parameter
     * @return the outcome; only {@link Outcome#CONNECTED} grants anything
     * @since v.0.1
     */
    public Outcome complete(String state, Long guildId) {
        if (state == null || state.isBlank() || guildId == null) return Outcome.INVALID_STATE;
        String nonceHash = Sha256.hex(state);
        GuildConnectRequest request = requestRepository.findById(nonceHash).orElse(null);
        // consume() decides the race: of two callbacks with one state, one deletes the row.
        if (request == null || requestRepository.consume(nonceHash) == 0) return Outcome.INVALID_STATE;
        if (request.getExpiresAt().isBefore(LocalDateTime.now())) return Outcome.INVALID_STATE;

        Long discordId = request.getDiscordId();
        GuildManagerCheck check = awaitManagerCheck(guildId, discordId);
        if (check == GuildManagerCheck.BOT_NOT_IN_GUILD) {
            log.warn("Bot-install callback for guild {}: the bot is not on it", guildId);
            return Outcome.BOT_NOT_IN_GUILD;
        }
        if (check != GuildManagerCheck.MANAGER) {
            log.warn("Bot-install callback: user {} does not manage guild {}", discordId, guildId);
            return Outcome.NOT_GUILD_MANAGER;
        }

        guildMembershipService.ensureMembership(discordId, guildId, GuildRole.OWNER);
        // Reinstalling on a guild the bot was previously kicked from must
        // flip its status back — getOrCreate() (called by ensureMembership)
        // only sets it on first creation, not on every call.
        guildService.markConnected(guildId);
        // Members and the bot's permissions right away (#124).
        guildService.sync(guildId);

        String username = userRepository.findByDiscordId(discordId).map(User::getDiscordUsername).orElse(null);
        auditLogService.logGuildActionAs(discordId, username, guildId, AuditAction.GUILD_CONNECTED,
                "USER", String.valueOf(discordId), username, Map.of("role", GuildRole.OWNER.name()),
                "Bot installed; installer verified as owner/manager via Discord");
        return Outcome.CONNECTED;
    }

    /**
     * Discord redirects right after adding the bot, and the bot learns of the
     * new guild over the Gateway a moment later — so wait briefly for it.
     */
    private GuildManagerCheck awaitManagerCheck(Long guildId, Long discordId) {
        long deadline = System.nanoTime() + botJoinWait.toNanos();
        while (true) {
            GuildManagerCheck check = botClient.checkGuildManager(guildId, discordId);
            if (check != GuildManagerCheck.BOT_NOT_IN_GUILD || !botClient.isAvailable()
                    || System.nanoTime() >= deadline) {
                return check;
            }
            try {
                Thread.sleep(250);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return check;
            }
        }
    }
}
