export const runVolumeBot = async (volumeKPs: Keypair[], mintAddress: PublicKey) => {
  const promises = volumeKPs.map(async (kp) => {
    const srcKp = kp;

    while (true) {
      const BUY_WAIT_INTERVAL = Math.round(Math.random() * (VOLUME_BOT_BUY_INTERVAL_MAX - VOLUME_BOT_BUY_INTERVAL_MIN) + VOLUME_BOT_BUY_INTERVAL_MIN);
      const SELL_WAIT_INTERVAL = Math.round(Math.random() * (VOLUME_BOT_SELL_INTERVAL_MAX - VOLUME_BOT_SELL_INTERVAL_MIN) + VOLUME_BOT_SELL_INTERVAL_MIN);
      const solBalance = await connection.getBalance(srcKp.publicKey);

      console.log("BUY_WAIT_INTERVAL", BUY_WAIT_INTERVAL);
      console.log("SELL_WAIT_INTERVAL", SELL_WAIT_INTERVAL);

      if (solBalance < 5 * 10 ** 6) {
        console.log("Sol balance is not enough in one of wallets");
        return;
      }

      console.log(`balance: ${solBalance / 10 ** 9}`);

      // Buy until success
      let buyAttempts = 0;
      while (true) {
        try {
          if (buyAttempts > 10) {
            console.log("Error in buy transaction");
            return;
          }
          const randomBuyAmount = getRandomBetween(VOLUME_BOT_BUY_LOWER_AMOUNT, VOLUME_BOT_BUY_UPPER_AMOUNT);

          const result = await buyByBundle(srcKp, mintAddress, randomBuyAmount)
          if (result) {
            break; // Exit loop on success
          } else {
            buyAttempts++;
            await sleep(2000); // Wait before retrying
          }
        } catch (error) {
          console.error("Error during buy operation:", error);
          buyAttempts++;
        }
      }

      await sleep(BUY_WAIT_INTERVAL * 1000);

      // Sell until success
      let sellAttempts = 0;
      while (true) {
        if (sellAttempts > 10) {
          console.log("Error in sell transaction");
          return;
        }
        const sellAmount = await getSPLBalance(connection, mintAddress, kp.publicKey);
        if (sellAmount) {
          const result = await sellByBundle(srcKp, mintAddress, sellAmount / 2)
          // const result = await sellWithPumpSDK(srcKp, mintAddress, sellAmount / 2);
          if (result) {
            break; // Exit loop on success
          } else {
            sellAttempts++;
            await sleep(2000); // Wait before retrying
          }
        }
      }

      await sleep(SELL_WAIT_INTERVAL * 1000);

      // Check SOL balance to continue
      const balance = await connection.getBalance(srcKp.publicKey);
      if (balance < 5 * 10 ** 6) {
        console.log("Sub wallet balance is not enough to continue volume swap");
        return;
      }
    }
  });

  // Wait for all Keypair processing to complete
  await Promise.all(promises);
}


const main = async () => {
  try {
    const mintAddress = new PublicKey(TOKEN_MINT)

    const volumeAmounts = new Array(VOLUME_BOT_WALLET_NUM).fill(VOLUME_BOT_FUND_AMOUNT_PER_WALLET);
    const volumeKPs = await distributeSol(connection, MAIN_KP, VOLUME_BOT_WALLET_NUM, volumeAmounts, VOLUME_WALLET_SOURCE);

    await sleep(15000); // Adjust sleep duration as needed
    if (!volumeKPs) return;

    await Promise.all([
      runVolumeBot(volumeKPs, mintAddress)
    ]);


  } catch (err) {
    console.log("err", err)
  }
}

main()
