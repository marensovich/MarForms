package me.marensovich.gta5rpformapp.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Back-to-back form edits merge into one journal entry (2026-10-19). */
class AuditMergeTest {

    @Test
    void theChangesAddUpAndEachFieldKeepsItsFirstBeforeAndLastAfter() {
        Map<String, Object> first = Map.of("changes", List.of("schema"),
                "diff", List.of(Map.of("field", "title", "before", "A", "after", "B")));
        Map<String, Object> second = Map.of("changes", List.of("schema", "webhooks"),
                "diff", List.of(Map.of("field", "title", "before", "B", "after", "C"),
                        Map.of("field", "webhooks", "before", "[]", "after", "[1]")));

        Map<String, Object> merged = AuditLogService.mergeMetadata(first, second);

        assertThat(merged.get("edits")).isEqualTo(2);
        assertThat(merged.get("changes")).isEqualTo(List.of("schema", "webhooks"));
        assertThat(merged.get("diff")).isEqualTo(List.of(
                Map.of("field", "title", "before", "A", "after", "C"),
                Map.of("field", "webhooks", "before", "[]", "after", "[1]")));
    }

    @Test
    void aFieldPutBackDropsOutOfTheDiff() {
        Map<String, Object> merged = AuditLogService.mergeMetadata(
                Map.of("edits", 3, "diff", List.of(Map.of("field", "title", "before", "A", "after", "B"))),
                Map.of("diff", List.of(Map.of("field", "title", "before", "B", "after", "A"))));

        assertThat(merged.get("edits")).isEqualTo(4);
        assertThat(merged).doesNotContainKey("diff");
    }

    @Test
    void detailLinesAreKeptOnce() {
        assertThat(AuditLogService.mergeDetails("Fields: 2\nTitle", "Title\nWebhooks")).isEqualTo("Fields: 2\nTitle\nWebhooks");
        assertThat(AuditLogService.mergeDetails(null, "Title")).isEqualTo("Title");
    }
}
