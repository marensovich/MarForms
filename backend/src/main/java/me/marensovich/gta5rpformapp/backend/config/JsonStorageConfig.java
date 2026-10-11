package me.marensovich.gta5rpformapp.backend.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.DeserializationConfig;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyName;
import com.fasterxml.jackson.databind.SerializationConfig;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.deser.BeanDeserializerBuilder;
import com.fasterxml.jackson.databind.deser.BeanDeserializerModifier;
import com.fasterxml.jackson.databind.deser.SettableBeanProperty;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.ser.BeanPropertyWriter;
import com.fasterxml.jackson.databind.ser.BeanSerializerModifier;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.type.format.jackson.JacksonJsonFormatMapper;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.util.List;

/**
 * The Jackson mapper Hibernate uses for JSON columns. It differs from the
 * web mapper in one way: {@link WebhookConfig#getUrl()} is written encrypted
 * and decrypted on read (#57), so {@code form.webhooks} never holds a webhook
 * token in plain text while the API and the services keep seeing plain URLs.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Configuration
public class JsonStorageConfig {

    private static final String URL_PROPERTY = "url";

    @Bean
    public HibernatePropertiesCustomizer jsonStorageFormatMapper(WebhookUrlCipher cipher) {
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules().registerModule(webhookUrlModule(cipher));
        return properties -> properties.put(AvailableSettings.JSON_FORMAT_MAPPER, new JacksonJsonFormatMapper(mapper));
    }

    static SimpleModule webhookUrlModule(WebhookUrlCipher cipher) {
        SimpleModule module = new SimpleModule("webhook-url-encryption");
        module.setSerializerModifier(new BeanSerializerModifier() {
            @Override
            public List<BeanPropertyWriter> changeProperties(SerializationConfig config, BeanDescription description,
                                                             List<BeanPropertyWriter> properties) {
                if (description.getBeanClass() == WebhookConfig.class) {
                    for (BeanPropertyWriter property : properties) {
                        if (URL_PROPERTY.equals(property.getName())) property.assignSerializer(new Sealing(cipher));
                    }
                }
                return properties;
            }
        });
        module.setDeserializerModifier(new BeanDeserializerModifier() {
            @Override
            public BeanDeserializerBuilder updateBuilder(DeserializationConfig config, BeanDescription description,
                                                         BeanDeserializerBuilder builder) {
                if (description.getBeanClass() == WebhookConfig.class) {
                    SettableBeanProperty url = builder.findProperty(PropertyName.construct(URL_PROPERTY));
                    if (url != null) builder.addOrReplaceProperty(url.withValueDeserializer(new Opening(cipher)), true);
                }
                return builder;
            }
        });
        return module;
    }

    private static final class Sealing extends StdSerializer<Object> {
        private final transient WebhookUrlCipher cipher;

        Sealing(WebhookUrlCipher cipher) {
            super(Object.class);
            this.cipher = cipher;
        }

        @Override
        public void serialize(Object value, JsonGenerator gen, SerializerProvider provider) throws IOException {
            gen.writeString(cipher.seal(value.toString()));
        }
    }

    private static final class Opening extends StdDeserializer<String> {
        private final transient WebhookUrlCipher cipher;

        Opening(WebhookUrlCipher cipher) {
            super(String.class);
            this.cipher = cipher;
        }

        @Override
        public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            return cipher.open(parser.getValueAsString());
        }
    }
}
