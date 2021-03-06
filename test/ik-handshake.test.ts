import Wrap from "it-pb-rpc";
import Duplex from 'it-pair/duplex';
import {Buffer} from "buffer";
import {assert, expect} from "chai";

import {createPeerIdsFromFixtures} from "./fixtures/peer";
import {generateKeypair, getPayload} from "../src/utils";
import {IKHandshake} from "../src/handshake-ik";

describe("IK Handshake", () => {
  let peerA, peerB, fakePeer;

  before(async () => {
    [peerA, peerB, fakePeer] = await createPeerIdsFromFixtures(3);
  });

  it("should finish both stages as initiator and responder", async() => {
    try {
      const duplex = Duplex();
      const connectionFrom = Wrap(duplex[0]);
      const connectionTo = Wrap(duplex[1]);

      const prologue = Buffer.alloc(0);
      const staticKeysInitiator = generateKeypair();
      const staticKeysResponder = generateKeypair();

      const initPayload = await getPayload(peerA, staticKeysInitiator.publicKey);
      const handshakeInit = new IKHandshake(true, initPayload, prologue, staticKeysInitiator, connectionFrom, staticKeysResponder.publicKey, peerB);

      const respPayload = await getPayload(peerB, staticKeysResponder.publicKey);
      const handshakeResp = new IKHandshake(false, respPayload, prologue, staticKeysResponder, connectionTo, staticKeysInitiator.publicKey);

      await handshakeInit.stage0();
      await handshakeResp.stage0();

      await handshakeResp.stage1();
      await handshakeInit.stage1();

      // Test shared key
      if (handshakeInit.session.cs1 && handshakeResp.session.cs1 && handshakeInit.session.cs2 && handshakeResp.session.cs2) {
        assert(handshakeInit.session.cs1.k.equals(handshakeResp.session.cs1.k));
        assert(handshakeInit.session.cs2.k.equals(handshakeResp.session.cs2.k));
      } else {
        assert(false);
      }

      // Test encryption and decryption
      const encrypted = handshakeInit.encrypt(Buffer.from("encryptthis"), handshakeInit.session);
      const {plaintext: decrypted} = handshakeResp.decrypt(encrypted, handshakeResp.session);
      assert(decrypted.equals(Buffer.from("encryptthis")));
    } catch (e) {
      console.error(e);
      assert(false, e.message);
    }
  });

  it("should throw error if responder's static key changed", async() => {
    try {
      const duplex = Duplex();
      const connectionFrom = Wrap(duplex[0]);
      const connectionTo = Wrap(duplex[1]);

      const prologue = Buffer.alloc(0);
      const staticKeysInitiator = generateKeypair();
      const staticKeysResponder = generateKeypair();
      const oldScammyKeys = generateKeypair();

      const initPayload = await getPayload(peerA, staticKeysInitiator.publicKey);
      const handshakeInit = new IKHandshake(true, initPayload, prologue, staticKeysInitiator, connectionFrom, oldScammyKeys.publicKey, peerB);

      const respPayload = await getPayload(peerB, staticKeysResponder.publicKey);
      const handshakeResp = new IKHandshake(false, respPayload, prologue, staticKeysResponder, connectionTo, staticKeysInitiator.publicKey);

      await handshakeInit.stage0();
      await handshakeResp.stage0();
    } catch (e) {
      expect(e.message).to.include("Error occurred while verifying initiator's signed payload");
    }
  });
});
