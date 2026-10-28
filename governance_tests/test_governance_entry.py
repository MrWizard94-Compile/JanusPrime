"""Positive project-governance contracts; no services, models or memory writes."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LINK_ROOT = Path(os.environ.get("JANUS_GOVERNANCE_LINK_ROOT", str(ROOT))).resolve()
CANONICAL = "https://github.com/MrWizard94-Compile/Agents-Constitution"
ENTRIES = (
    "AGENTS.md", "CLAUDE.md", "Project-Janus/AGENTS.md", "Project-Janus/CLAUDE.md",
    "AssetConverter-sparse/AGENTS.md", "AssetConverter-sparse/CLAUDE.md",
    "Smart-Library/AGENTS.md",
)


class GovernanceEntryTests(unittest.TestCase):
    def test_all_entries_route_to_canonical_law_without_vendored_pack(self):
        for relative in ENTRIES:
            with self.subTest(path=relative):
                text = (ROOT / relative).read_text(encoding="utf-8-sig")
                self.assertIn(CANONICAL, text)
                self.assertIn("wpai-constitution", text)
                # Assemble inert negative-test operands; they are not loader routes.
                self.assertNotIn("AGENTS " + "Constitution/", text)
                self.assertNotIn("verify-" + "pack.ps1", text)
        root = (ROOT / "AGENTS.md").read_text(encoding="utf-8-sig")
        for contract in ("freeze", "SOURCE", "same revision", "task-id", "validation-receipt"):
            self.assertIn(contract, root)

    def test_project_doctrine_keeps_product_context_not_constitutional_authority(self):
        text = (ROOT / "CLAUDE.md").read_text(encoding="utf-8-sig")
        for contract in ("JanusPrime Single Source of Truth for project doctrine",
                         "not constitutional law", "Validation before mutation",
                         "Corwin", "Smart-Library", "AssetConverter", "doc:claude",
                         "janus://doctrine/claude", "claude_doctrine", "resolved_context",
                         "12,000", "2,000", "4,000", "1,500", "3,000",
                         "CLAUDE001", "CLAUDE004", "asset-audit-v1", "python-sandbox-v1",
                         "seed_on_accept", "seed_on_heal", "first-attempt", "seedAcceptedTask"):
            with self.subTest(contract=contract):
                self.assertIn(contract, text)
        readme = (ROOT / "README.md").read_text(encoding="utf-8-sig")
        self.assertIn("Janus product contracts loaded through `doc:claude`", readme)
        self.assertNotIn("Single source of truth for all agents and gates", readme)

    def test_memory_component_restores_mocked_test_and_data_boundaries(self):
        text = (ROOT / "Smart-Library/AGENTS.md").read_text(encoding="utf-8-sig")
        for contract in ("no network", "Ollama, Chroma, Docker", "client_ollama_down",
                         "client_startup_failed", "/seed", "/execute-heal",
                         "/maintenance/deduplicate", "API_KEY", "MAX_CODE_BYTES",
                         "SANDBOX_FAIL_CLOSED", "tests/test_security.py",
                         "does not establish safe production authentication"):
            with self.subTest(contract=contract):
                self.assertIn(contract, text)

    def test_bootstrap_is_not_automatic_live_mutation_authority(self):
        root = (ROOT / "AGENTS.md").read_text(encoding="utf-8-sig")
        for contract in ("does not authorize", "memory seeding", "service startup",
                         "publishing or spending", "not a bootstrap script",
                         "Never overwrite an existing `.env`", "doctrine seed",
                         "loop run", "assets queue"):
            with self.subTest(contract=contract):
                self.assertIn(contract, root)

    def test_changed_markdown_links_resolve_within_the_owned_project(self):
        for relative in (*ENTRIES, "README.md", "docs/GOVERNANCE-ADOPTION.md"):
            text = (ROOT / relative).read_text(encoding="utf-8-sig")
            for link in re.findall(r"(?<!!)\[[^\]]*\]\(([^)]+)\)", text):
                target = link.strip("<>").split("#", 1)[0]
                if not target or re.match(r"[a-z]+://", target):
                    continue
                with self.subTest(path=relative, target=target):
                    candidate = ((ROOT / relative).parent / target).resolve()
                    self.assertTrue(candidate.is_relative_to(ROOT))
                    fallback = ((LINK_ROOT / relative).parent / target).resolve()
                    self.assertTrue(fallback.is_relative_to(LINK_ROOT))
                    self.assertTrue(candidate.is_file() or fallback.is_file())

    def test_real_product_loader_and_capped_excerpt_retain_authority_boundary(self):
        # Use the built JavaScript consumer, retaining the declared Node >=20 stack.
        loader = LINK_ROOT / "Project-Janus/packages/janus-integrations/dist/claude.js"
        self.assertTrue(loader.is_file(), "Run the normal Project-Janus build before loader checks")
        script = """
const {loadClaude, excerptClaude, hashClaude} = await import(process.argv[1]);
const content = await loadClaude(process.argv[2], {doctrine: {claude_path: 'CLAUDE.md'}});
process.stdout.write(JSON.stringify({content, excerpt: excerptClaude(content, 1500),
                                    hash: hashClaude(content)}));
"""
        result = subprocess.run(
            [os.environ.get("JANUS_GOVERNANCE_NODE", "node"), "--input-type=module", "-e",
             script, loader.as_uri(), str(ROOT)],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", timeout=20,
        )
        self.assertEqual(result.stderr, "", "Loader must not emit warnings or errors")
        data = json.loads(result.stdout)
        expected_bytes = (ROOT / "CLAUDE.md").read_bytes()
        self.assertEqual(data["content"], expected_bytes.decode("utf-8"))
        self.assertEqual(data["hash"], hashlib.sha256(expected_bytes).hexdigest())
        self.assertLessEqual(len(data["excerpt"]), 1500)
        for contract in (CANONICAL, "not constitutional law", "doc:claude",
                         "Validation before mutation", "does not authorize"):
            with self.subTest(contract=contract):
                self.assertIn(contract, data["excerpt"])


if __name__ == "__main__":
    unittest.main()
