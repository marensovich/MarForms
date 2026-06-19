package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository interface for accessing {@link Form} entities in the database.
 * <p>
 * Provides CRUD operations and custom query methods for form management.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface FormRepository extends JpaRepository<Form, UUID> {

    /**
     * Retrieves a paginated list of all active forms.
     * <p>
     * Only returns forms where the {@code active} flag is set to {@code true}.
     * Used for displaying available forms to users.
     * </p>
     *
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of active {@link Form} entities
     * @since v.0.1
     */
    Page<Form> findAllByActiveTrue(Pageable pageable);
}