export type EventPayload =
  | {
      type: "access.request.created";
      householdId: string;
      requestId: string;
      kind: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";
      requesterUserId: string;
    }
  | {
      type: "access.request.approved";
      householdId: string;
      requestId: string;
      requesterUserId: string;
      resultingDeviceId: string;
    }
  | {
      type: "access.request.rejected";
      householdId: string;
      requestId: string;
      requesterUserId: string;
    }
  | {
      type: "access.request.expired";
      householdId: string;
      requestId: string;
      requesterUserId: string;
    }
  | {
      type: "access.request.envelope_delivered";
      householdId: string;
      deviceId: string;
      keyEpoch: number;
    }
  | {
      type: "household.key.rotation.requested";
      householdId: string;
      fromEpoch: number;
      toEpoch: number;
    }
  | {
      type: "household.key.rotated";
      householdId: string;
      epoch: number;
    }
  | {
      type: "household.member.removed";
      householdId: string;
      removedUserId: string;
    }
  | {
      type: "household.device.removed";
      householdId: string;
      deviceId: string;
      deviceUserId: string;
    };

export const EVENT_CHANNEL = "wohnly_events";
