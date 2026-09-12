"""
Test the "agents-update" event — report which distributed agents are running.

GLIMPSE builds its agent roster from the loaded model (GET
/api/gridappsd/agents), which says which agents *should* exist for it. This
event is how something outside GLIMPSE reports which of them are actually up.

Payload contract:
    {
        "model": "<model mRID or filename>",     # optional; enables caching
        "agents": [
            {
                "agent_id": "<unique id>",
                "message_bus_id": "<area mRID, or 'system'>",
                "status": "online" | "offline" | "unknown",
                # optional; a payload carrying these replaces the roster
                # wholesale instead of updating status in place
                "agent_type": "coordinating" | "distributed",
                "level": "system" | "feeder" | "switch" | "secondary",
                "area_name": "...",
                "devices": [{"mrid", "name", "type", "phases"}]
            }
        ]
    }

A payload with only ids and statuses is merged into the existing roster, so a
liveness ping can't discard the areas and devices the model load established.

This script needs a model loaded in GLIMPSE to have something to update — load
IEEE123 through the UI first, then pass one of its switch-area mRIDs as
AREA_MRID (or just run it as-is to exercise validation and the broadcast).

    python socket-testing/test_agents.py
"""

import common

# Replace with a real switch-area mRID from a loaded model to watch a specific
# agent's status dot change in the UI. Any id works for the broadcast itself —
# the frontend keeps agents it doesn't recognize.
AREA_MRID = "system"


def main():
    sio = common.connect()
    try:
        # [1] A well-formed liveness report.
        print("\n[1] Report one agent online")
        common.call(sio, "agents-update", {
            "model": "ieee123",
            "agents": [
                {"agent_id": "coordinating-1", "message_bus_id": "system", "status": "online"},
                {"agent_id": "switch-agent-1", "message_bus_id": AREA_MRID, "status": "online"},
            ],
        })
        sio.sleep(1.5)

        # [2] The same agents going down — the panel's dots should turn red.
        print("\n[2] Report the same agents offline")
        common.call(sio, "agents-update", {
            "model": "ieee123",
            "agents": [
                {"agent_id": "coordinating-1", "message_bus_id": "system", "status": "offline"},
                {"agent_id": "switch-agent-1", "message_bus_id": AREA_MRID, "status": "offline"},
            ],
        })
        sio.sleep(1.5)

        # [3] Validation: the payload must be an object carrying an agents list.
        print("\n[3] Rejected payloads (each should ack with an error)")
        common.call(sio, "agents-update", {"agents": "not-a-list"})
        common.call(sio, "agents-update", "not-an-object")
        common.call(sio, "agents-update", {})

        print("\nDone.")
    finally:
        sio.disconnect()


if __name__ == "__main__":
    main()
