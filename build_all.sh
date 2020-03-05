#!/bin/bash
./src/node_modules/.bin/electron-packager ./src --all --osx-sign --out=build/ --overwrite --asar
