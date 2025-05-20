// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
假设一个学校，存储所有的学生信息
1.仅有序：如果用一个数组存学生信息的话，那么增加和删除都要动很多个slot
2.仅高效增删改：如果用mapping(address=Student)的话，又没有办法list方法来遍历学生

于是用linkArray来实现链表，既有序又高效增删改
1.需要用一个数组来装所有的索引，也就是地址，但是没有排序的需要
2.用一个mapping来装 索引=>Student的结构，而且Student中有next属性
用来指向下一个学生的address索引，这样这个mapping结合array就变得“有序”且“高效增删改”了
*/ 

contract linkArray {
    uint public listSize;

    // 链表头
    address constant FIRST = address(1);
    // 属性1指针
    mapping(address => address) _nextSdt;
    // 属性2score
    mapping(address => uint) public score;

    constructor() {
        // 循环列表
        _nextSdt[FIRST] = FIRST;
        listSize = 0;
    }

    // 验证
    function _verifyIndex(address prev, uint newValue, address next) internal view returns(bool) {
        // 鉴定 A -> New -> B是否真的是 A.value > new.value > B.value
        // 如果A或者B是FIRST都可以免于那一侧检查，因为FIRST是边界，没有value
        bool leftOk = prev == FIRST || score[prev] >= newValue;
        bool rightOk = next == FIRST || newValue >= score[next];
        return leftOk && rightOk;
    }

    function addSdt(
        address newSdt,
        address toWhom,
        uint newScore
    ) public {
        // 把newSdt安插到toWhom的后面
        // 本来 toWhom -> toWhom.next
        // 变成 toWhom -> newSdt -> toWhom.next
        require(_nextSdt[newSdt] == address(0),"newSdt already exist!");
        require(_nextSdt[toWhom] != address(0),"nextSdt not exist!");
        require(_verifyIndex(toWhom, newScore, _nextSdt[toWhom]), "value not ordered!");
        // 插入新元素
        _nextSdt[newSdt] = _nextSdt[toWhom];
        _nextSdt[toWhom] = newSdt;
        score[newSdt] = newScore;
        // 人数增加
        listSize += 1;
    }

    function removeSdt(address sdtToRemove, address prevSdt) public {
        // 
        require(_nextSdt[sdtToRemove] != address(0), "no student to remove!");
        require(_nextSdt[prevSdt] == sdtToRemove, "wrong student to update _next");
        // 修改指针
        _nextSdt[prevSdt] = _nextSdt[sdtToRemove];
        // 删除属性next和score
        _nextSdt[sdtToRemove] = address(0);
        score[sdtToRemove] = 0;
        // 人数减少
        listSize -= 1;
    }

    function undateScore(address updateSdt, uint newValue, address removeFromWhom, address addToWhom) public {
        // 原来的 removeFromWhom -> updateSdt 变成 removeFromWhom -> updateSdt.next
        require(
            _nextSdt[updateSdt] != address(0) &&
            _nextSdt[removeFromWhom] != address(0) &&
            _nextSdt[addToWhom] != address(0),
            "invalid student!"
        );
        // 如果removeFrom和addToWhom是同一个人，那么就不用改链
        // 链上验证是不是真的符合要求
        if (removeFromWhom == addToWhom) {
            require(_nextSdt[removeFromWhom] == updateSdt);
            require(_verifyIndex(removeFromWhom, newValue, _nextSdt[updateSdt]));
            score[updateSdt] = newValue;
        } else {
            removeSdt(updateSdt, removeFromWhom);
            addSdt(updateSdt, addToWhom, newValue);
        }
    }

    function getTop(uint k) public view returns(address[] memory) {
        // 因为本来指针安排好就是有序的，从FIRST开始数k个就是
        require(k <= listSize, "student not enough!");
        address[] memory sdtList = new address[](k);
        address currAddr = _nextSdt[FIRST];
        for (uint i=0; i < k; i++) {
            sdtList[i] = currAddr;
            currAddr = _nextSdt[currAddr];
        }
        return sdtList;     
    }
}