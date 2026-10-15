package me.marensovich.gta5rpformapp.backend.dto.submission;

/**
 * Counters of the «Все · На рассмотрении · С решением» segments of «Мои заявки»
 * (ТЗ ФТ-3.6.2).
 *
 * @param all     every own submission
 * @param pending awaiting a decision
 * @param decided approved, rejected or sent back for revision
 * @author marensovich
 * @since v.0.1
 */
public record MySubmissionCountsDto(long all, long pending, long decided) {
}
