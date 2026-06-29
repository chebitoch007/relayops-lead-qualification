import json
import sys

with open("/home/claude/relayops/n8n/relayops-lead-qualification.json") as f:
    wf = json.load(f)

errors = []

node_names = [n["name"] for n in wf["nodes"]]
node_ids = [n["id"] for n in wf["nodes"]]

if len(node_names) != len(set(node_names)):
    dupes = {n for n in node_names if node_names.count(n) > 1}
    errors.append(f"Duplicate node names: {dupes}")

if len(node_ids) != len(set(node_ids)):
    errors.append("Duplicate node ids")

name_set = set(node_names)
for source_name, kinds in wf["connections"].items():
    if source_name not in name_set:
        errors.append(f"Connection source '{source_name}' is not a real node")
    for kind, outputs in kinds.items():
        for output_idx, edges in enumerate(outputs):
            for edge in edges:
                if edge["node"] not in name_set:
                    errors.append(
                        f"Connection target '{edge['node']}' (from {source_name} "
                        f"output {output_idx}, kind {kind}) is not a real node"
                    )

# Every non-sticky, non-trigger node should be reachable as a connection
# target from somewhere (catches orphaned nodes from a typo'd connect call).
trigger_types = {"n8n-nodes-base.webhook"}
cosmetic_types = {"n8n-nodes-base.stickyNote"}
all_targets = set()
for kinds in wf["connections"].values():
    for outputs in kinds.values():
        for edges in outputs:
            for edge in edges:
                all_targets.add(edge["node"])

for n in wf["nodes"]:
    if n["type"] in trigger_types or n["type"] in cosmetic_types:
        continue
    if n["name"] not in all_targets:
        errors.append(f"Orphaned node (nothing connects to it): {n['name']}")

# Required top-level keys for a valid n8n export
for key in ("name", "nodes", "connections"):
    if key not in wf:
        errors.append(f"Missing top-level key: {key}")

# Every node needs id/name/type/typeVersion/position/parameters
for n in wf["nodes"]:
    for field in ("id", "name", "type", "typeVersion", "position", "parameters"):
        if field not in n:
            errors.append(f"Node '{n.get('name', '?')}' missing field: {field}")

print(f"Nodes: {len(wf['nodes'])}")
print(f"Connections (source nodes with outgoing edges): {len(wf['connections'])}")

if errors:
    print(f"\n{len(errors)} ISSUE(S) FOUND:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("\nNo structural issues found.")
