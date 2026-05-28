# Touch To CONNECT - Glossary of Terms

This will serve as a source for a glossary of terms that we use when talking
about our WebRTC Application - _CONNECT_.

## Session Traversal Utilities for NAT (STUN)

A request to a STUN server is to discover a host's public IP address when it is
located behind a NAT/Firewall. When a host wants to recieve an incoming
connection from another host this public IP adress is a possible location where
it could get a connection. If a NAT/Firewall still will not allow the hosts to
connect directly they can use a _TURN_ server to make a connection to relay data
between the parties.

## Traversal Using Relay around NAT (TURN)

A relay of data (media) between connected parties.

## Interactive Connectivity Establishment (ICE)

is a standard that describes how to coordinate STUN and TURN to make a
connection between hosts.

## ICE Candidate

The IP and port pairs that a host can attempt to use to connect to a session.

## Session Description Protocol (SDP) - Offer

An RTCPeerConnection description and offer to init a WebRTC call. This offer
will contain session details like codec, video and or audio call type. and a
list of ICE candidates.
