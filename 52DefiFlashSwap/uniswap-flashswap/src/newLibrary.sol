
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice minimal Uniswap V2 Pair interface needed
interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

library UniswapV2Library {
    /// @notice performs chained getAmountIn calculations on any number of pairs
    /// @param factory    address of the UniswapV2 factory
    /// @param amountOut  the desired output amount of the last token
    /// @param path       an array of token addresses (length >= 2)
    /// @return amounts   array of required input amounts at each step
    function getAmountsIn(
        address factory,
        uint amountOut,
        address[] memory path
    ) internal view returns (uint[] memory amounts) {
        require(path.length >= 2, 'UniswapV2Library: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        // traverse backwards: for each step, compute required input to get desired output
        for (uint i = path.length - 1; i > 0; i--) {
            (uint reserveIn, uint reserveOut) = getReserves(factory, path[i - 1], path[i]);
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    /// @notice calculate input amount for given output and reserves, accounting for 0.3% fee
    function getAmountIn(
        uint amountOut,
        uint reserveIn,
        uint reserveOut
    ) internal pure returns (uint amountIn) {
        require(amountOut > 0, 'UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        uint numerator = reserveIn * amountOut * 1000;
        uint denominator = (reserveOut - amountOut) * 997;
        return numerator / denominator + 1;
    }

    /// @notice fetch and sort reserves for a pair
    function getReserves(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (uint reserveA, uint reserveB) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(
            pairFor(factory, token0, token1)
        ).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    /// @notice returns sorted token addresses
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
    }

    /// @notice calculates CREATE2 pair address without external calls
    function pairFor(
        address factory,
        address token0,
        address token1
    ) internal pure returns (address pair) {
        // cast keccak256 hash to address via uint160
        pair = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            hex'ff',
                            factory,
                            keccak256(abi.encodePacked(token0, token1)),
                            // init code hash for UniswapV2 Pair (unchanged)
                            hex'e04b7751126569d9acca26c11cf961d1326a9998f49cab691625a1ac5324cbab'
                        )
                    )
                )
            )
        );
    }
}

