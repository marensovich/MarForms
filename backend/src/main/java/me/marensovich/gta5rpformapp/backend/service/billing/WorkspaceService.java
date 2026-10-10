package me.marensovich.gta5rpformapp.backend.service.billing;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.Workspace;
import me.marensovich.gta5rpformapp.backend.database.entity.WorkspaceGuild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.WorkspaceGuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.WorkspaceRepository;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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
