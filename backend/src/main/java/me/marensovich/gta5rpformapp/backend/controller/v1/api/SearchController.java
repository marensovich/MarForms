package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.dto.search.SearchResultsDto;
import me.marensovich.gta5rpformapp.backend.service.SearchService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The dashboard's ⌘K search (ТЗ ФТ-4.1.3, #107).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    /**
     * Finds forms, submissions and users the caller may open; see {@link SearchService}.
     *
     * @param principal the signed-in user
     * @param q         the typed text; fewer than 2 characters → empty results
     * @return up to 5 hits per type
     * @since v.0.1
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public SearchResultsDto search(@AuthenticationPrincipal CustomUserDetails principal,
                                   @RequestParam(defaultValue = "") String q) {
        return searchService.search(principal.getUser(), principal.getPermissions(), q);
    }
}
