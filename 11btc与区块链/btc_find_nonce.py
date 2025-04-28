from hashlib import sha256
import time

# sha256加密，并检查是否符合要求
def encrypt_and_check_if_valid(s1,s2, require_zero_nums=4):
    # 一、加密
    s = str(s1) + str(s2)
    res = sha256(s.encode('utf-8')).hexdigest()

    # 二、检查是否符合  
    startZeros = '0' * require_zero_nums
    isValid = True if res.startswith(startZeros) else False

    return res,isValid

def find_and_cal_time(myName):
    startTime = time.time()
    initNonce = 0
    require_zero_nums = 4
    while require_zero_nums <= 5:        
        hashStr, isValid = encrypt_and_check_if_valid(myName, str(initNonce), require_zero_nums)
        # print('4-',initNonce,hashStr)
        # print(initNonce)
        if isValid:
            time1 = time.time() - startTime
            print('耗时%.2fs找到nonce【%s】使得【%s】hash结果%s个0开头: %s' % 
                (time1,initNonce,myName+str(initNonce),require_zero_nums,hashStr))
            require_zero_nums += 1
        initNonce += 1


if __name__ == '__main__':
    find_and_cal_time('bi4o')