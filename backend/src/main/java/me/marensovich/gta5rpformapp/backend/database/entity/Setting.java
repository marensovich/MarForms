package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@Table(name = "settings")
public class Setting {

    @Id
    @Column(nullable = false)
    private String key;

    @Column(columnDefinition = "TEXT")
    private String value;

    public Setting(String key, String value) {
        this.key = key;
        this.value = value;
    }
}