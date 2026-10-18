package me.marensovich.gta5rpformapp.backend.config.security;

import lombok.Getter;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
public class CustomUserDetails implements UserDetails {

    private final User user;

    public CustomUserDetails(User user) {
        this.user = user;
    }

    public Long getDiscordId() {
        return user.getDiscordId();
    }

    public Set<Permission> getPermissions() {
        Set<Permission> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .collect(Collectors.toSet());
        // SYSTEM_ADMIN includes every right above it (ТЗ 2.2).
        return permissions.contains(Permission.SYSTEM_ADMIN) ? EnumSet.allOf(Permission.class) : permissions;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return getPermissions().stream()
                .map(permission -> new SimpleGrantedAuthority(permission.name()))
                .collect(Collectors.toSet());
    }

    @Override
    public String getUsername() {
        return String.valueOf(user.getDiscordId());
    }

    @Override
    public String getPassword() {
        return null; // аутентификация только через Discord OAuth, пароля нет
    }

    @Override
    public boolean isAccountNonLocked() {
        return !user.isCurrentlyBanned();
    }

    @Override
    public boolean isEnabled() {
        return !user.isCurrentlyBanned();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }
}