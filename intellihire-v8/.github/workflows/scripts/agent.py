#!/usr/bin/env python3
"""
OpenRouter Agent for GitHub Actions
Generates/modifies code and outputs changes for commit.
"""

import os
import sys
import json
import argparse
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
import requests
from dataclasses import dataclass


@dataclass
class FileChange:
    path: str
    content: str
    action: str  # 'create', 'modify', 'delete'


class OpenRouterClient:
    def __init__(self, api_key: str, model: str, base_url: str = "https://openrouter.ai/api/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com",  # Required by OpenRouter
            "X-Title": "GitHub Actions Agent"
        }

    def chat_completion(self, messages: List[Dict], temperature: float = 0.3) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 4000
        }
        
        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers=self.headers,
            json=payload,
            timeout=120
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


class CodeAgent:
    def __init__(self, client: OpenRouterClient, repo_root: Path):
        self.client = client
        self.repo_root = repo_root
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        prompt_path = Path(__file__).parent / "prompts" / "system_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_system_prompt()

    def _default_system_prompt(self) -> str:
        return """You are an expert software engineer. Given a task, you will:
1. Analyze the repository structure
2. Generate or modify code files
3. Return changes in a structured JSON format

Output ONLY valid JSON with this structure:
{
  "changes": [
    {"path": "relative/path.py", "content": "file content", "action": "create|modify|delete"},
    ...
  ],
  "summary": "Brief description of changes made"
}"""

    def get_repo_context(self, max_files: int = 20) -> str:
        """Get repository structure and key files for context."""
        context_parts = ["## Repository Structure\n"]
        
        # Get file tree
        try:
            result = subprocess.run(
                ["git", "ls-files"], 
                cwd=self.repo_root, capture_output=True, text=True
            )
            files = result.stdout.strip().split('\n')[:max_files]
            context_parts.append("```\n" + "\n".join(files) + "\n```")
        except:
            pass
        
        # Read key files
        key_patterns = ['*.py', '*.js', '*.ts', '*.json', '*.md', '*.yaml', '*.yml']
        for pattern in key_patterns:
            for file in self.repo_root.rglob(pattern):
                if file.is_file() and file.stat().st_size < 10000:  # < 10KB
                    try:
                        rel_path = file.relative_to(self.repo_root)
                        content = file.read_text()
                        context_parts.append(f"\n## File: {rel_path}\n```\n{content}\n```")
                    except:
                        pass
                        
        return "\n".join(context_parts)

    def run_task(self, task: str) -> List[FileChange]:
        """Execute the agent task and return file changes."""
        context = self.get_repo_context()
        
        user_prompt = f"""## Task
{task}

## Repository Context
{context}

Generate the necessary file changes to complete this task. Return ONLY the JSON structure specified."""

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        print(f"🤖 Calling OpenRouter model: {self.client.model}")
        response = self.client.chat_completion(messages)
        
        # Parse JSON response
        try:
            # Extract JSON from markdown code blocks if present
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            
            result = json.loads(response.strip())
            changes = []
            for change in result.get("changes", []):
                changes.append(FileChange(
                    path=change["path"],
                    content=change["content"],
                    action=change.get("action", "modify")
                ))
            print(f"✅ Agent generated {len(changes)} file changes")
            print(f"📋 Summary: {result.get('summary', 'No summary')}")
            return changes
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse agent response: {e}")
            print(f"Raw response: {response[:500]}...")
            raise

    def apply_changes(self, changes: List[FileChange]) -> bool:
        """Apply changes to the filesystem."""
        if not changes:
            return False
            
        for change in changes:
            file_path = self.repo_root / change.path
            
            if change.action == "delete":
                if file_path.exists():
                    file_path.unlink()
                    print(f"🗑️ Deleted: {change.path}")
            else:
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(change.content)
                action = "Created" if change.action == "create" else "Modified"
                print(f"✏️ {action}: {change.path}")
        
        return True


def main():
    parser = argparse.ArgumentParser(description="OpenRouter GitHub Agent")
    parser.add_argument("--task", required=True, help="Task description")
    parser.add_argument("--model", default="anthropic/claude-3.5-sonnet", help="OpenRouter model")
    args = parser.parse_args()

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ OPENROUTER_API_KEY environment variable not set")
        sys.exit(1)

    repo_root = Path(__file__).parent.parent
    client = OpenRouterClient(api_key, args.model)
    agent = CodeAgent(client, repo_root)

    try:
        changes = agent.run_task(args.task)
        has_changes = agent.apply_changes(changes)
        
        # Output for GitHub Actions
        print(f"changes_made={'true' if has_changes else 'false'}")
        if has_changes:
            # Write to GITHUB_OUTPUT for next step
            github_output = os.getenv("GITHUB_OUTPUT")
            if github_output:
                with open(github_output, "a") as f:
                    f.write("changes_made=true\n")
    except Exception as e:
        print(f"❌ Agent failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
    