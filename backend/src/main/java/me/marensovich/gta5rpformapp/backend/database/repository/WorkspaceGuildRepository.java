package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.WorkspaceGuild;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkspaceGuildRepository extends JpaRepository<WorkspaceGuild, Long> {

    List<WorkspaceGuild> findAllByWorkspaceId(UUID workspaceId);
}
