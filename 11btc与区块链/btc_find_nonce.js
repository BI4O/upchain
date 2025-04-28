const { createHash } = require('crypto');

// 加密且检查是否符合要求
const encrypt = (s1,s2,require_zero_num=4) => {
    const res = createHash('sha256').update(s1+s2).digest('hex');
    const isValid = res.startsWith(Array(require_zero_num + 1).join(0)); 
    // console.log(res);
    return { res, isValid };
}

// 循环查看
const find_and_cal_time = (name) => {
    let require_zero_num = 4;
    let nonce = 0;
    const startTime = performance.now();
    let markTime;
    while (require_zero_num <= 5) {
        const {res, isValid} = encrypt(name,nonce.toString(),require_zero_num);
        if (isValid) {
            markTime = (performance.now() - startTime).toFixed(2)
            console.log(`耗时${markTime}ms找到了nonce${nonce.toString()}加密[${name + nonce.toString()}]开头${require_zero_num}个0的hash值${res}`);
            require_zero_num += 1;
        }
        nonce += 1;
    }
}


find_and_cal_time('bi4o');