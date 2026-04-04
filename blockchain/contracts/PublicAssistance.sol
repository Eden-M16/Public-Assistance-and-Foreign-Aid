// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PublicAssistance {
    struct AidRequest {
        address payable recipient;
        string description;
        uint256 amountRequested;
        uint256 amountReceived;
        bool completed;
    }

    address public owner;
    AidRequest[] public requests;
    mapping(address => uint256) public donations;
    uint256 public totalDonated;

    event Donated(address indexed donor, uint256 amount);
    event RequestCreated(uint256 indexed requestId, address indexed recipient, uint256 amount);
    event AidSent(uint256 indexed requestId, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function donate() public payable {
        require(msg.value > 0, "Donation must be greater than 0");
        donations[msg.sender] += msg.value;
        totalDonated += msg.value;
        emit Donated(msg.sender, msg.value);
    }

    function requestAid(string memory _description, uint256 _amount) public {
        require(_amount > 0, "Requested amount must be greater than 0");
        requests.push(AidRequest({
            recipient: payable(msg.sender),
            description: _description,
            amountRequested: _amount,
            amountReceived: 0,
            completed: false
        }));
        emit RequestCreated(requests.length - 1, msg.sender, _amount);
    }

    function approveAid(uint256 _requestId) public onlyOwner {
        require(_requestId < requests.length, "Invalid request ID");
        AidRequest storage request = requests[_requestId];
        require(!request.completed, "Request already completed");
        require(address(this).balance >= request.amountRequested, "Insufficient contract balance");

        request.completed = true;
        request.amountReceived = request.amountRequested;
        request.recipient.transfer(request.amountRequested);

        emit AidSent(_requestId, request.recipient, request.amountRequested);
    }

    function getRequestsCount() public view returns (uint256) {
        return requests.length;
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
