#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Configuration loader for LeverAPI
Searches for config.json in multiple locations and loads it
"""

import json
import sys
from pathlib import Path


def load_config():
    """
    Load configuration from config.json
    Search paths (in order):
    1. ./config.json (current directory)
    2. ../config.json (parent directory)
    3. ../../config.json (grandparent directory)
    4. [executable]/config.json (relative to PyInstaller executable)
    5. [executable]/../config.json
    6. [executable]/../../config.json

    Returns:
        dict: Configuration dictionary, or {} if not found
    """
    search_paths = [
        Path.cwd() / 'config.json',
        Path.cwd().parent / 'config.json',
        Path.cwd().parent.parent / 'config.json',
    ]

    # For PyInstaller frozen executables, also search relative to executable
    if getattr(sys, 'frozen', False):
        exe_dir = Path(sys.executable).parent
        search_paths.extend([
            exe_dir / 'config.json',
            exe_dir.parent / 'config.json',
            exe_dir.parent.parent / 'config.json',
        ])

    for config_path in search_paths:
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    print(f'[Config] Loaded from: {config_path}')
                    return config
            except Exception as e:
                print(f'[Config] Failed to parse {config_path}: {e}')

    print('[Config] No config.json found, using defaults')
    return {}
