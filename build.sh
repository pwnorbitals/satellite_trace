#!/bin/bash
./node_modules/.bin/electron-packager . --all --electron-version=1.4.15 --osx-sign --out=build/ --overwrite
