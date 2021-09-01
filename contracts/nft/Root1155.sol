pragma solidity ^0.8.0;

import "../ecosystem/openzeppelin/access/Ownable.sol";
import "../ecosystem/openzeppelin/token/ERC1155/extensions/ERC1155Burnable.sol";

/**
 * @title Root1155
 */
contract Root1155 is ERC1155Burnable, Ownable {

    uint256 private _currentTokenID = 0;
    mapping (uint256 => address) public creators;
    mapping (uint256 => uint256) public tokenSupply;

    /**
    * @dev Require msg.sender to be the creator of the token id
    */
    modifier onlyCreator(uint256 _id) {
        require(creators[_id] == msg.sender, "Root1155#onlyCreator: ONLY_CREATOR_ALLOWED");
        _;
    }

    /**
    * @dev Require msg.sender to own more than 0 of the token id
    */
    modifier onlyHolder(uint256 _id) {
        require(balanceOf(msg.sender, _id) > 0, "Root1155#onlyHolder: ONLY_OWNERS_ALLOWED");
        _;
    }

    constructor (string memory uri_) ERC1155(uri_) {}

    /**
    * @dev Creates a new token type and assigns _initialSupply to an address
    * @param _initialOwner address of the first owner of the token
    * @param _initialSupply amount to supply the first owner
    * @param _uri Optional URI for this token type
    * @param _data Data to pass if receiver is contract
    * @return The newly created token ID
    */
    function create(
        address _initialOwner,
        uint256 _initialSupply,
        string calldata _uri,
        bytes calldata _data
    ) 
        external 
        onlyOwner 
        returns(uint256) 
    {

        uint256 _id = _currentTokenID;
        _incrementTokenTypeId();
        creators[_id] = msg.sender;

        if (bytes(_uri).length > 0) {
            emit URI(_uri, _id);
        }

        _mint(_initialOwner, _id, _initialSupply, _data);
        tokenSupply[_id] = _initialSupply;
        return _id;
    }

    /**
    * @dev Mints some amount of tokens to an address
    * @param _to          Address of the future owner of the token
    * @param _id          Token ID to mint
    * @param _quantity    Amount of tokens to mint
    * @param _data        Data to pass if receiver is contract
    */
    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data
    ) 
        public 
        onlyCreator(_id) 
    {
        _mint(_to, _id, _quantity, _data);
        tokenSupply[_id] = tokenSupply[_id] + _quantity;
    }

    /**
    * @dev Returns whether the specified token exists by checking to see if it has a creator
    * @param _id uint256 ID of the token to query the existence of
    * @return bool whether the token exists
    */
    function _exists(uint256 _id) 
        internal 
        view 
        returns (bool) 
    {
        return creators[_id] != address(0);
    }

    /**
    * @return uint256 for max token ID
    */
    function getMaxTokenID() 
        public 
        view
        returns(uint256)
    {
        return _currentTokenID;
    }
    
    /**
    * @dev increments the value of _currentTokenID
    */
    function _incrementTokenTypeId() private {
        _currentTokenID++;
    }
}