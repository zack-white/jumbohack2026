================================================================================
# PingPoint
================================================================================
## Created by: Massimo Bottari, Dan Glorioso, Hannah Jiang, Holden Kittelberger, Shayne Sidman, Zachary White

Presented at JumboHack 2026 under the CYBERSECURITY track.

### THE PROJECT
PingPoint is a real-time network visibility tool designed to help everyday users understand what’s happening on their WiFi without needing technical expertise. Our goal was to capture live packet data, analyze devices and open ports using automated scanning, and use AI to translate complex network activity into clear, user-friendly insights. Over the weekend, we built a working pipeline that parses traffic, runs device scans, visualizes the network in an interactive 2D map, and generates plain-language summaries with an LLM so users can quickly understand potential risks.

### TEAM
Massimo Bottari: prototyped and frontend styling
Dan Glorioso: set up the Wi-Fi network
Hannah Jiang: designed the dashboard + logo
Holden Kittelberger: backend nmap and raspberry pi setup
Shayne Sidman: setup scap, LLM, and frontend styling
Zack White: implemented frontend styling and API routing

### ACKNOWLEDGEMENTS
ChatGPT: for fine-tuning and brainstorming
Claude: API system

### REFLECTION
<What motivated your team to choose this project?>
Our team chose this project because the theme of security felt both timely and impactful. We were motivated by a desire to better understand how networks actually work behind the scenes, especially how data moves and where vulnerabilities can exist. At the same time, we wanted to build something that makes security more accessible, helping non-technical users feel more informed and confident about what’s happening on their own WiFi networks.

<Potential future work/improvements?>
For future work, we would like to conduct more extensive testing across edge cases and extreme network scenarios, such as sudden traffic spikes, device spoofing, or multiple simultaneous threats. We also plan to test the system against more advanced network errors and misconfigurations to ensure reliability and accuracy under complex conditions. These tests would help strengthen the robustness of our detection pipeline and improve the quality of the AI-generated insights.

<What is a challenge you encountered while making this?>
One major challenge we encountered was navigating network configurations and setting up the WiFi router to properly capture and analyze traffic. Working through permissions, device discovery, and router-level settings required troubleshooting and an understanding of how local networks operate. 

<What is a fun or interesting experience you had with another hacker?>
Spending time as a team!
