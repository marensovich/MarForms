package me.marensovich.gta5rpformapp.backend.service.billing;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.Subscription;
import me.marensovich.gta5rpformapp.backend.database.entity.Workspace;
import me.marensovich.gta5rpformapp.backend.database.entity.WorkspaceGuild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubscriptionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.WorkspaceGuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.WorkspaceRepository;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Workspaces (ADR 0004): every guild belongs to exactly one, created
 * implicitly with the guild; billing hangs off the workspace.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceGuildRepository workspaceGuildRepository;
    private final GuildRepository guildRepository;
    private final GuildMembershipRepository guildMembershipRepository;
    private final SubscriptionRepository subscriptionRepository;

    /** Stripe statuses during which the subscription's tier applies. */
    static final Set<String> LIVE_STATUSES = Set.of("active", "trialing", "past_due");

    /**
     * The guild's workspace, creating its implicit single-guild workspace
     * if it has none yet (guilds connected after migration V14).
     *
     * @param guildId the Discord guild snowflake ID
     * @return the workspace
     * @throws NotFoundException if the guild isn't known
     * @since v.0.1
     */
    @Transactional
    public Workspace forGuild(Long guildId) {
        return workspaceGuildRepository.findById(guildId)
                .flatMap(link -> workspaceRepository.findById(link.getWorkspaceId()))
                .orElseGet(() -> createImplicit(guildId));
    }

    /**
     * @param workspaceId the workspace
     * @return the Discord IDs of its guilds
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public List<Long> guildIds(UUID workspaceId) {
        return workspaceGuildRepository.findAllByWorkspaceId(workspaceId).stream()
                .map(WorkspaceGuild::getGuildId).toList();
    }

    /**
     * Puts every guild of the workspace on a plan tier: what the plan
     * limits (E4.1) read.
     *
     * @param workspaceId the workspace
     * @param tier        the tier
     * @since v.0.1
     */
    @Transactional
    public void applyPlan(UUID workspaceId, PlanTier tier) {
        for (Long guildId : guildIds(workspaceId)) {
            guildRepository.findById(guildId).ifPresent(guild -> {
                if (guild.getPlanTier() != tier) {
                    guild.setPlanTier(tier);
                    guildRepository.save(guild);
                }
            });
        }
    }

    /**
     * Moves a guild into another workspace (E4.3, #99/#100): it then shares
     * that workspace's subscription and plan. Its previous workspace, if
     * left empty, is removed. Refused while the guild's current workspace
     * has a live subscription of its own, so nobody pays twice.
     *
     * @param guildId           the guild to move
     * @param targetWorkspaceId the workspace it joins
     * @param actorUserId       {@link me.marensovich.gta5rpformapp.backend.database.entity.User#getId()} of the owner
     *                          doing it; becomes the target's owner if it has none
     * @since v.0.1
     */
    @Transactional
    public void moveGuild(Long guildId, UUID targetWorkspaceId, Long actorUserId) {
        Workspace current = forGuild(guildId);
        if (current.getId().equals(targetWorkspaceId)) return;
        Workspace target = workspaceRepository.findById(targetWorkspaceId)
                .orElseThrow(() -> new NotFoundException("Workspace not found"));
        if (hasLiveSubscription(current.getId()) && guildIds(current.getId()).size() == 1) {
            throw new InvalidStateException("This server has its own subscription: cancel it before joining another one");
        }
        if (target.getOwnerUserId() == null) {
            target.setOwnerUserId(actorUserId);
            workspaceRepository.save(target);
        }
        workspaceGuildRepository.save(new WorkspaceGuild(guildId, target.getId()));
        removeIfEmpty(current.getId());
        applyPlan(target.getId(), effectivePlan(target.getId()));
    }

    /**
     * Takes a guild out of a shared workspace into a new one of its own, on
     * the free plan (the subscription stays with the workspace).
     *
     * @param guildId the guild
     * @throws InvalidStateException if it is already alone in its workspace
     * @since v.0.1
     */
    @Transactional
    public void detachGuild(Long guildId) {
        Workspace current = forGuild(guildId);
        if (guildIds(current.getId()).size() <= 1) {
            throw new InvalidStateException("This server is not sharing a subscription");
        }
        workspaceGuildRepository.deleteById(guildId);
        workspaceGuildRepository.flush();
        Workspace own = createImplicit(guildId);
        applyPlan(own.getId(), PlanTier.FREE);
    }

    /**
     * The tier a workspace's guilds should be on: its subscription's while
     * that is live, otherwise free.
     *
     * @param workspaceId the workspace
     * @return the tier
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public PlanTier effectivePlan(UUID workspaceId) {
        return subscriptionRepository.findByWorkspaceId(workspaceId)
                .filter(s -> LIVE_STATUSES.contains(s.getStatus()))
                .map(Subscription::getPlanTier)
                .orElse(PlanTier.FREE);
    }

    private boolean hasLiveSubscription(UUID workspaceId) {
        return subscriptionRepository.findByWorkspaceId(workspaceId)
                .filter(s -> LIVE_STATUSES.contains(s.getStatus())).isPresent();
    }

    private void removeIfEmpty(UUID workspaceId) {
        if (!workspaceGuildRepository.findAllByWorkspaceId(workspaceId).isEmpty()) return;
        // Keep a workspace that still has a Stripe customer: its billing history lives there.
        boolean hasBillingHistory = subscriptionRepository.findByWorkspaceId(workspaceId)
                .map(s -> s.getStripeCustomerId() != null).orElse(false);
        if (!hasBillingHistory) {
            subscriptionRepository.findByWorkspaceId(workspaceId).ifPresent(subscriptionRepository::delete);
            workspaceRepository.deleteById(workspaceId);
        }
    }

    private Workspace createImplicit(Long guildId) {
        Guild guild = guildRepository.findById(guildId)
                .orElseThrow(() -> new NotFoundException("Unknown server " + guildId));
        Workspace workspace = new Workspace();
        workspace.setName(guild.getName().length() > 100 ? guild.getName().substring(0, 100) : guild.getName());
        workspace.setOwnerUserId(guildMembershipRepository.findAllByGuild_DiscordGuildIdAndRole(guildId, GuildRole.OWNER)
                .stream().findFirst().map(m -> m.getUser().getId()).orElse(null));
        workspace = workspaceRepository.save(workspace);
        workspaceGuildRepository.save(new WorkspaceGuild(guildId, workspace.getId()));
        return workspace;
    }
}
