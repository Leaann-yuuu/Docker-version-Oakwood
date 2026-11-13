@echo off
title OakWood Subdivision - Dual Camera Streamer & LPR Service
cd /d "%~dp0"
echo ====================================================================
echo  OakWood Subdivision Gate & Camera Controller
echo  Connecting Entrance Camera and Exit Camera...
echo  Broadcasting live video to web dashboards on Port 5000
echo ====================================================================
python python/lpr_gate_controller.py
pause

