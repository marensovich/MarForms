package me.marensovich.gta5rpformapp.backend.config.JWT;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Utility class for generating, validating, and parsing JWT tokens.
 * <p>
 * This service handles token creation with user claims, validation of expiration,
 * and extraction of user ID from JWT tokens.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
public class JwtUtil {

    /**
     * Secret key used for signing JWT tokens.
     * Loaded from application properties.
     *
     * @since v.0.1
     */
    @Value("${jwt.secret}")
    private String secretKey;

    /**
     * Token expiration time in milliseconds.
     * Loaded from application properties.
     *
     * @since v.0.1
     */
    @Value("${jwt.expiration}")
    private long expiration;

    /**
     * Secret key object used for signing JWTs.
     *
     * @since v.0.1
     */
    private Key key;

    /**
     * Initializes the signing key after the bean is constructed.
     * <p>
     * Throws an exception if the secret key is not configured properly.
     * </p>
     *
     * @throws IllegalArgumentException if the secret key is null or blank
     * @throws RuntimeException         if key initialization fails
     * @since v.0.1
     */
    @PostConstruct
    public void init() {
        try {
            if (secretKey == null || secretKey.isBlank()) {
                throw new IllegalArgumentException("JWT secret key is not configured");
            }
            this.key = Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize JWT key", e);
        }
    }

    /**
     * Generates a JWT token containing the user ID as a claim.
     *
     * @param userId the ID of the user to encode in the token
     * @return a signed JWT token string
     * @since v.0.1
     */
    public String generateToken(Long userId) {
        return generateToken(userId, 0);
    }

    /**
     * Generates a JWT for a user's current token version (see
     * {@code User#getTokenVersion()}).
     *
     * @param userId       the user's Discord ID
     * @param tokenVersion the user's token version
     * @return the signed token
     * @since v.0.1
     */
    public String generateToken(Long userId, int tokenVersion) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("ver", tokenVersion);
        return createToken(claims);
    }

    /**
     * Creates a JWT token with the given claims.
     * <p>
     * Sets the issued date to the current time and the expiration date based on
     * the configured expiration duration.
     * </p>
     *
     * @param claims the claims to include in the token
     * @return a signed JWT token string
     * @since v.0.1
     */
    private String createToken(Map<String, Object> claims) {
        return Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Validates a JWT token by checking its signature and expiration date.
     *
     * @param token the JWT token to validate
     * @return {@code true} if the token is valid and not expired, {@code false} otherwise
     * @since v.0.1
     */
    public boolean validateToken(String token) {
        try {
            Claims claims = extractAllClaims(token);
            Date expiration = claims.getExpiration();
            return !expiration.before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Extracts all claims from a JWT token.
     *
     * @param token the JWT token to parse
     * @return a {@link Claims} object containing all claims from the token
     * @throws io.jsonwebtoken.JwtException if the token is invalid or expired
     * @since v.0.1
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /**
     * Extracts the user ID from a JWT token.
     *
     * @param token the JWT token containing the user ID claim
     * @return the user ID stored in the token claims
     * @throws io.jsonwebtoken.JwtException if the token is invalid or the claim is missing
     * @since v.0.1
     */
    public Long getUserIdFromToken(String token) {
        return extractClaim(token, claims -> claims.get("userId", Long.class));
    }

    /**
     * @param token a validated token
     * @return the token version it was issued under, {@code null} for tokens
     * issued before versions existed
     * @since v.0.1
     */
    public Integer getTokenVersion(String token) {
        return extractClaim(token, claims -> claims.get("ver", Integer.class));
    }

    /**
     * Extracts a specific claim from a JWT token using a resolver function.
     *
     * @param <T>            the type of the claim to extract
     * @param token          the JWT token
     * @param claimsResolver a function that extracts the desired claim from {@link Claims}
     * @return the extracted claim value
     * @throws io.jsonwebtoken.JwtException if the token is invalid
     * @since v.0.1
     */
    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }
}