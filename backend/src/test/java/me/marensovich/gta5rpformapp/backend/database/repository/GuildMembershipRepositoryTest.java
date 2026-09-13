package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class GuildMembershipRepositoryTest {

    @org.springframework.beans.factory.annotation.Autowired
    private UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private GuildRepository guildRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private GuildMembershipRepository guildMembershipRepository;

    private User persistUser(long discordId) {
        User user = new User();
        user.setDiscordId(discordId);
        user.setDiscordUsername("tester-" + discordId);
        return userRepository.save(user);
    }

    private Guild persistGuild(long discordGuildId) {
        Guild guild = new Guild();
        guild.setDiscordGuildId(discordGuildId);
        guild.setName("Ashgrove RP");
        guild.setConnectedAt(LocalDateTime.now());
        return guildRepository.save(guild);
    }

    @Test
    void savesAndReloadsAnOwnerMembership() {
        User user = persistUser(1001L);
        Guild guild = persistGuild(2001L);

        GuildMembership membership = new GuildMembership();
        membership.setUser(user);
        membership.setGuild(guild);
        membership.setRole(GuildRole.OWNER);
        guildMembershipRepository.save(membership);

        Optional<GuildMembership> reloaded =
                guildMembershipRepository.findByUser_IdAndGuild_DiscordGuildId(user.getId(), guild.getDiscordGuildId());

        assertThat(reloaded).isPresent();
        assertThat(reloaded.get().getRole()).isEqualTo(GuildRole.OWNER);
        assertThat(reloaded.get().getGuild().getName()).isEqualTo("Ashgrove RP");
    }

    @Test
    void rejectsASecondMembershipForTheSameUserAndGuild() {
        User user = persistUser(1002L);
        Guild guild = persistGuild(2002L);

        GuildMembership first = new GuildMembership();
        first.setUser(user);
        first.setGuild(guild);
        first.setRole(GuildRole.RESPONDENT);
        guildMembershipRepository.saveAndFlush(first);

        GuildMembership duplicate = new GuildMembership();
        duplicate.setUser(user);
        duplicate.setGuild(guild);
        duplicate.setRole(GuildRole.MODERATOR);

        assertThatThrownBy(() -> guildMembershipRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findsModeratorsOfAGuildByRole() {
        Guild guild = persistGuild(2003L);
        User owner = persistUser(1003L);
        User moderator = persistUser(1004L);

        GuildMembership ownerMembership = new GuildMembership();
        ownerMembership.setUser(owner);
        ownerMembership.setGuild(guild);
        ownerMembership.setRole(GuildRole.OWNER);
        guildMembershipRepository.save(ownerMembership);

        GuildMembership moderatorMembership = new GuildMembership();
        moderatorMembership.setUser(moderator);
        moderatorMembership.setGuild(guild);
        moderatorMembership.setRole(GuildRole.MODERATOR);
        guildMembershipRepository.save(moderatorMembership);

        var moderators = guildMembershipRepository.findAllByGuild_DiscordGuildIdAndRole(
                guild.getDiscordGuildId(), GuildRole.MODERATOR);

        assertThat(moderators).hasSize(1);
        assertThat(moderators.getFirst().getUser().getDiscordId()).isEqualTo(1004L);
    }
}
