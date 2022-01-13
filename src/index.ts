import { BigNumber, providers, Wallet } from 'ethers'
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle'
import { ethers } from 'ethers'
import { resolve } from 'path/posix'

const FLASHBOTS_ENDPOINT = 'https://relay-goerli.flashbots.net'
const CHAIN_ID = 5
// const FLASHBOTS_ENDPOINT = "https://relay.flashbots.net"; // Mainnet
// const CHAIN_ID = 1; // Mainnet
// const provider = new providers.InfuraProvider(CHAIN_ID)
const provider = new providers.InfuraProvider(CHAIN_ID, process.env.INFURA_API_KEY)

require('dotenv').config()
const ETHEREUM_PUBLIC_KEY = '0x4cc7a243009eEdAe6650f63A4c2C2E9496b356E9'
const ETHEREUM_SMART_CONTRACT = '0x20EE855E43A7af19E407E39E5110c2C1Ee41F64D'
const PRIVATE_KEY = process.env.PRIVATE_KEY as string
const wallet = new Wallet(PRIVATE_KEY, provider)

main()

async function main() {
  // change to your Wallet when you want priority in Flashbot
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, Wallet.createRandom(), FLASHBOTS_ENDPOINT)
  provider.on('block', async (blockNumber) => {
    console.log(`blockNumber: ${blockNumber}`)
    const targetBlockNumber = blockNumber + 1
    const feeDataExtendend = await getFeeDataAndLog()
    logFeeData(feeDataExtendend)
    const maxFeePerGas = (feeDataExtendend.feeData.maxFeePerGas as BigNumber).add(ethers.utils.parseUnits('50', 'gwei'))
    console.log('Increased maxFeePerGas: ' + maxFeePerGas)
    const maxPriorityFeePerGas = (feeDataExtendend.feeData.maxPriorityFeePerGas as BigNumber).add(ethers.utils.parseUnits('1', 'gwei'))
    console.log('Increased maxPriorityFeePerGas: ' + maxPriorityFeePerGas)
    const transactionBundle = [
      {
        transaction: {
          chainId: CHAIN_ID,
          type: 2,
          value: ethers.utils.parseEther('0.03'),
          data: '0x1249c58b',
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFeePerGas,
          // maxPriorityFeePerGas: ethers.utils.parseUnits('50', 'gwei'),
          // maxFeePerGas: ethers.utils.parseUnits('50', 'gwei'),
          to: ETHEREUM_SMART_CONTRACT
        },
        signer: wallet
      }
    ]

    // Simulate
    /*     const signedTransactions = await flashbotsProvider.signBundle(transactionBundle)
    const simulation = await flashbotsProvider.simulate(signedTransactions, targetBlockNumber)
    console.log(simulation) */
    // console.log(`Simulation gasUsed: ${(simulation as any).results[0].gasUsed}`);

    // SendBundle
    const bundleSubmitResponse = await flashbotsProvider.sendBundle(transactionBundle, targetBlockNumber)

    // By exiting this function (via return) when the type is detected as a "RelayResponseError", TypeScript recognizes bundleSubmitResponse must be a success type object (FlashbotsTransactionResponse) after the if block.
    if ('error' in bundleSubmitResponse) {
      console.log(bundleSubmitResponse.error.message)
      return
    }
    const simulateResponse = await bundleSubmitResponse.simulate()
    const waitResponse = await bundleSubmitResponse.wait()
    if (waitResponse === 1) {
      console.log(`WAITING: ${waitResponse},   txHash: ${(simulateResponse as any).results[0].txHash}`)
    } else if (waitResponse === 0) {
      console.log(`SUCCESS: ${waitResponse},   txHash: ${(simulateResponse as any).results[0].txHash}`)
      process.exit(0)
    } else {
      console.log(`UNDEFINED: ${waitResponse},   txHash: ${(simulateResponse as any).results[0].txHash}`)
      process.exit(0)
    }
  })
}
function logFeeData(feeDataExtendend: { feeData: any; gasPriceEstimation: BigNumber }) {
  const gasEstimateFormatted = {
    gasPrice:
      parseFloat(ethers.utils.formatUnits(feeDataExtendend.feeData.gasPrice, 'gwei')).toFixed(2) +
      '  BigNumber: ' +
      feeDataExtendend.feeData.gasPrice,
    maxFeePerGas:
      parseFloat(ethers.utils.formatUnits(feeDataExtendend.feeData.maxFeePerGas, 'gwei')).toFixed(2) +
      '  BigNumber: ' +
      feeDataExtendend.feeData.maxFeePerGas,
    maxPriorityFeePerGas:
      parseFloat(ethers.utils.formatUnits(feeDataExtendend.feeData.maxPriorityFeePerGas, 'gwei')).toFixed(2) +
      '  BigNumber: ' +
      feeDataExtendend.feeData.maxPriorityFeePerGas,
    gasPriceEstimation:
      parseFloat(ethers.utils.formatUnits(feeDataExtendend.gasPriceEstimation, 'gwei')).toFixed(2) +
      '  BigNumber: ' +
      feeDataExtendend.gasPriceEstimation
  }
  console.log({ gasPrices: gasEstimateFormatted })
}

async function getFeeDataAndLog() {
  const feeData: any = await provider.getFeeData()
  const gasPriceEstimation = await provider.getGasPrice()
  return { feeData, gasPriceEstimation: gasPriceEstimation }
}
