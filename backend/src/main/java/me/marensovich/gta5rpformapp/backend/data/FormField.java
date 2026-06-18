package me.marensovich.gta5rpformapp.backend.data;

import java.util.List;

public class FormField {

    private String id;
    private FieldType type;

    private String label;
    private boolean required;

    private List<String> options;

    private Integer max;
    private Integer min;

    public enum FieldType {
        TEXT,
        TEXTAREA,
        NUMBER,
        EMAIL,
        PASSWORD,
        URL,
        PHONE,
        SELECT,
        MULTI_SELECT,
        RADIO,
        CHECKBOX,
        BOOLEAN,
        DATE,
        TIME,
        DATETIME
    }
}
