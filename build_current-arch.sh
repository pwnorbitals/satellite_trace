#!/bin/bash
./src/node_modules/.bin/electron-packager ./src --osx-sign --out=build/ --overwrite --asar
