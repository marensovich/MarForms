package me.marensovich.gta5rpformapp.backend.service.billing;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

/**
 * The few Stripe API calls billing needs (E4.2), over plain REST: Stripe's
 * API is form-encoded and three calls don't justify the SDK. Webhooks are
 * verified by {@link StripeWebhookVerifier}.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component
@RequiredArgsConstructor
public class StripeClient {

    private final StripeProperties properties;
    private final RestTemplate restTemplate;

    /**
     * Creates a customer for a workspace.
     *
     * @param name        shown in the Stripe dashboard
     * @param workspaceId kept in the customer's metadata
     * @return the customer id
     * @since v.0.1
     */
    public String createCustomer(String name, String workspaceId) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("name", name);
        form.add("metadata[workspaceId]", workspaceId);
        return post("/v1/customers", form).path("id").asText();
    }

    /**
     * Creates a subscription Checkout session.
     *
     * @param customerId  the workspace's customer
     * @param priceId     the price to subscribe to
     * @param workspaceId set as client reference and on the subscription's
     *                    metadata, so webhooks can find the workspace
     * @param plan        the tier, kept in the subscription's metadata
     * @param successUrl  where Stripe sends the owner after paying
     * @param cancelUrl   where Stripe sends the owner if they back out
     * @return the Checkout page URL
     * @since v.0.1
     */
    public String createCheckoutSession(String customerId, String priceId, String workspaceId, String plan,
                                        String successUrl, String cancelUrl) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("mode", "subscription");
        form.add("customer", customerId);
        form.add("line_items[0][price]", priceId);
        form.add("line_items[0][quantity]", "1");
        form.add("client_reference_id", workspaceId);
        form.add("subscription_data[metadata][workspaceId]", workspaceId);
        form.add("subscription_data[metadata][plan]", plan);
        form.add("success_url", successUrl);
        form.add("cancel_url", cancelUrl);
        return post("/v1/checkout/sessions", form).path("url").asText();
    }

    /**
     * Creates a Billing Portal session, where the owner changes or cancels
     * the subscription and updates payment details.
     *
     * @param customerId the workspace's customer
     * @param returnUrl  where the portal's back link goes
     * @return the portal URL
     * @since v.0.1
     */
    public String createPortalSession(String customerId, String returnUrl) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("customer", customerId);
        form.add("return_url", returnUrl);
        return post("/v1/billing_portal/sessions", form).path("url").asText();
    }

    private JsonNode post(String path, MultiValueMap<String, String> form) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBearerAuth(properties.secretKey());
        JsonNode body = restTemplate.postForObject(properties.apiBase() + path, new HttpEntity<>(form, headers), JsonNode.class);
        if (body == null) throw new IllegalStateException("Empty response from Stripe");
        return body;
    }
}
