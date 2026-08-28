'use strict';
// Stage 2 lands `Tip` here: the growth agent that reads the genome tape.
//
// Per MODEL.md a tip is a LOCAL ACCUMULATOR — it sits on a node, draws that node's water and
// sugar into itself, and builds when it has banked enough. It must never draw from a shared
// plant pool; that is what forecloses the proliferate-meristems exploit and what makes
// self-pruning work. Fields will be: position, heading, read head, per-tip working copy of
// the genome, and its own water/sugar bank.
//
// Stage 1 is the environment only, so there is nothing here yet. The file stays in the load
// order so adding it later touches no entry points.
