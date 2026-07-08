package com.booking.system.repository;

import com.booking.system.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, String> {
    List<PushSubscription> findByUserIdAndIsActiveTrue(String userId);

    List<PushSubscription> findByUserIdOrderByLastSeenAtDescCreatedAtDesc(String userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    Optional<PushSubscription> findByEndpointAndUserId(String endpoint, String userId);
}
