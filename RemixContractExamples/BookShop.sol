// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BookShop {
    // 书店有书和读者两个实体
    enum BookStatus { Avi, Bro, Sold}
    struct Book {
        uint id;
        string title;
        BookStatus status;
    }

    struct Reader {
        uint id;
        string name;
    }

    function showAllBooks() public view {
        
    }

}