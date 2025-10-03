# WebChat - Product Requirements Document

## Overview

WebChat is a real-time messaging application with video calling capabilities, built as a final year Computer Science graduation project. The application enables users to communicate through text messaging (both one-on-one and group conversations) and conduct video calls with audio.

This is a solo development project with a 17-18 week timeline. The primary goal is to demonstrate understanding of real-time communication technologies and full-stack development, not to create a production-ready application at scale.

**Project Type:** Graduation Project (Solo Developer)  
**Duration:** 17-18 weeks  
**Focus:** Core functionality over complex architecture

## Goals

- Build a functional real-time chat application from scratch
- Learn and implement WebSocket communication (Socket.IO)
- Learn and implement WebRTC for peer-to-peer video calling
- Demonstrate full-stack development skills (Frontend + Backend + Database)
- Successfully complete and present for graduation

## Features

### Core Features (Must Have)

**1. Authentication**

- User registration with email and password
- User login/logout
- JWT-based authentication
- Password hashing (bcrypt)
- Session management

**2. Friend System**

- Add friend (simplified: auto-accept)
- View friends list
- Remove friend
- Online/offline status

**3. Chat System (1-1 & Group)**

- Send and receive messages in real-time
- One-on-one private conversations
- Group conversations (3+ people)
- Message history persistence
- Display sender name and timestamp
- Typing indicators
- Online/offline status indicators

**4. Video Call (1-1 Only)**

- Initiate video call to a friend
- Accept or reject incoming calls
- Video stream with audio
- Basic controls: mute/unmute, camera on/off, end call
- Call notification system

**5. Media Upload**

- Upload and send images in chat
- Upload and send videos (small files)
- Upload and send documents (PDF, etc.)
- Media preview in chat interface
- Cloud storage for uploaded files

### Secondary Features (Nice to Have)

- Message read receipts
- User profile customization
- Message reactions/emojis
- Search messages

## Tech Stack

**Frontend:**

- React 18+
- Vite (build tool)
- Tailwind CSS (styling)
- Socket.IO Client (real-time)
- PeerJS (WebRTC wrapper)

**Backend:**

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL (database)
- Socket.IO (WebSocket server)
- JWT (authentication)

**Media Storage:**

- Cloudinary or similar cloud service

**Deployment:**

- Frontend: Vercel
- Backend: Render or similar
- Database: Hosted PostgreSQL

## Out of Scope

**What We're NOT Building:**

- Scaling to thousands of concurrent users
- Mobile applications (iOS/Android)
- End-to-end message encryption
- Group video calls (only 1-1)
- Message search functionality
- Advanced admin dashboard
- Payment or subscription features
- Message editing/deletion
- File size limits beyond basic validation
- Advanced security features (rate limiting, DDoS protection)

## Success Criteria

The project is considered successful when:

- Users can register and login securely
- Users can add friends and see their online status
- Users can send and receive messages in real-time (1-1 and group)
- Users can initiate and conduct 1-1 video calls with audio
- Users can upload and share media files in chat
- The application runs smoothly with 5-10 concurrent users (demo scale)
- Code is organized, readable, and demonstrates understanding of concepts
- Application can be successfully demoed during graduation presentation

## Constraints

**Timeline:** 17-18 weeks total development time  
**Resources:** Solo developer (no team)  
**Scope:** Graduation project, not production software  
**Scale:** Optimized for demo and small-scale usage  
**Budget:** Free or minimal cost services only  
**Learning Curve:** Socket.IO and WebRTC are new technologies to learn

**Philosophy:**

- Prioritize functionality over perfect architecture
- Simple solutions over complex ones
- Learning and understanding over speed
- Avoid over-engineering
