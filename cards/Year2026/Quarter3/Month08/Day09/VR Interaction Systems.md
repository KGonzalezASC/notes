---
title: VR Interaction Systems
description: A project archive of custom Unity VR interactions and a data-driven architecture for sequencing gameplay tasks.
date: 2026-08-09
tags:
  - projects
  - archive
  - vr
  - unity
  - interaction-design
  - architecture
featured: false
excerpt: A project archive of custom Unity VR interactions and a data-driven architecture for sequencing gameplay tasks.
---

# VR Interaction Systems

This archive preserves a set of custom Unity VR interaction systems and the gameplay architecture used to sequence them. The original material deliberately removes NDA-related content, so the visual evidence is intentionally limited.

[Open the original VR Interactions Description document](https://docs.google.com/document/d/1XZ7OsyAUp3fVqD191-bI7Ufp3IH7F4bDCm0woUKapQE/edit?usp=sharing)

## Interaction library

### 1. Twist socket interactor

[Interaction reference](https://drive.google.com/file/d/1ACUe0-aDbZiRD4nzQZevWsdaUKEvaXU-/view?usp=drive_link)

The user can take regular grab interactables and insert them into sockets. Reclaiming the object requires twisting until the socket reaches its specified torque threshold and releases the screw. Twist sockets support screwing with or without tools depending on the process configuration.

**Use cases:** Screwing in parts, twist valves, knobs, and levers.

[Gameplay VOD](https://drive.google.com/file/d/1GGq1u-6GJHE8qe7I03rUT0LlGOXwd790/view?usp=drive_link)

### 2. Staged socket installation

[Interaction reference](https://drive.google.com/file/d/1lmxeoCekyM90we3GRfQY2Wxg16PZOUIH/view?usp=drive_link)

Installing an object provides a short time buffer for completing the interaction. The ejection action—an object falling because it was not secured—is queued into a command buffer and can be stopped by installing and twisting in a screw.

### 3. Two-handed grab interactables

[Interaction reference](https://drive.google.com/file/d/1fhHlzIXu9P-aZ6zCVwdj3k_vez1crCIL/view?usp=drive_link)

When a grab interactable uses multiple selection, Unity normally treats one hand as the position and the other as a pivot. This custom interaction instead keeps the object between both hands and lets the user twist it with both hands in tandem.

The system also implements predictive visual transforms so the result can remain physically based. Attachments on a two-handed interactable can track correctly without waiting for a rigidbody update.

**Use cases:** Boxes, push carts, and equipment that is more naturally held at both ends.

### 4. Dynamic socket interactor

[Interaction reference](https://drive.google.com/file/d/1Sm8f9UDH04GXFTyw5eubbfM8rWZfyikS/view?usp=drive_link)

Standard sockets place an item at one configured attachment transform. This custom socket allows the item to attach at any position within the socket's trigger area.

**Use case:** Any socket where the player should choose where an object is placed.

### 5. Multi-dynamic socket interactor

[Interaction reference](https://drive.google.com/file/d/1zxDLXqwpysWiYaWEYuKjjEdWJ8bDqjP3/view?usp=drive_link)

Multiple objects can be placed on the same socket surface at the same time.

### 6. Locking socket

[Interaction reference](https://drive.google.com/file/d/1klGVLDXuEXS6qkagsTWk3v8ohYrgF72c/view?usp=drive_link)

A locking socket is useful when a main grab interactable contains sub-interactions but the parent object should not be accidentally grabbed.

### 7. VR doors

[Interaction reference](https://drive.google.com/file/d/1FKdyfeRlTfXOsOPeMfPRARy-XOMgEtLr/view?usp=drive_link)

VR doors cannot be treated as ordinary grab interactables because their tracking modes can fight with Unity hinge physics. This interaction translates interactor input into a form that works cleanly with a Unity hinge.

The source document labels this as another “Interaction 6”; the numbering is normalized here for readability.

## Gameplay architecture

As the number of grab interactables, sockets, and interaction states grows, it becomes difficult to track progression and determine when a VR sequence is complete. This architecture uses data-driven gameplay sequences with time tracking and reset support.

- [Gameplay architecture UML](https://drive.google.com/file/d/1NNYehYG4mNbT0rEZmhs28oBnXBC1CDc1/view?usp=drive_link)
- [Gameplay process](https://drive.google.com/file/d/1z93f01tb0iA8fOrADhVMUcC3eiPLRkmd/view?usp=drive_link)

## VIP system

[VIP system reference](https://drive.google.com/file/d/1GpWA0THu_PWuBfvE5PKAaYUeLf3rX3Hc/view?usp=drive_link)

Rather than loading a new scene for each task, the system dynamically configures the existing gameplay according to the current sequence through Scriptable Object builders.

## Article status

This archive record is a starting point for a future technical article about interaction ownership, predictive transforms, command buffering, and data-driven VR task sequencing. The original document and its evidence links remain available so the work is discoverable in the meantime.
